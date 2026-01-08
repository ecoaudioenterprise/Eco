import { useEffect } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Geolocation } from "@capacitor/geolocation";

export const NotificationsManager = () => {
  useEffect(() => {
    let myNotificationsSubscription: any = null;
    let newAudiosSubscription: any = null;

    const cleanupSubscriptions = async () => {
      if (myNotificationsSubscription) await supabase.removeChannel(myNotificationsSubscription);
      if (newAudiosSubscription) await supabase.removeChannel(newAudiosSubscription);
      myNotificationsSubscription = null;
      newAudiosSubscription = null;
      
      if (Capacitor.getPlatform() !== 'web') {
          await PushNotifications.removeAllListeners();
      }
    };

    const registerPushNotifications = async (userId: string) => {
        if (Capacitor.getPlatform() === 'web') return;

        try {
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.log('User denied push permissions');
                return;
            }

            await PushNotifications.register();

            // Remove existing listeners to avoid duplicates
            await PushNotifications.removeAllListeners();

            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token: ' + token.value);
                const { error } = await supabase
                    .from('profiles')
                    .update({ fcm_token: token.value })
                    .eq('id', userId);
                
                if (error) console.error('Error saving FCM token:', error);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Error on registration: ' + JSON.stringify(error));
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received: ' + JSON.stringify(notification));
                // Optional: handle foreground notification logic if needed
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Push action performed: ' + JSON.stringify(notification));
                // TODO: Navigate to notification screen
            });
        } catch (e) {
            console.error("Error setting up push notifications:", e);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
    
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
        return R * c;
    };

    const setupNotifications = async (user: any) => {
      await cleanupSubscriptions();
      
      // Setup Push Notifications (FCM)
      await registerPushNotifications(user.id);

      // 1. Request permissions (Local)
      const { display } = await LocalNotifications.checkPermissions();
      if (display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      console.log("Setting up notifications for user:", user?.id || 'anonymous');

      // 2. Subscribe to NEW AUDIOS (Proximity Alert)
      newAudiosSubscription = supabase
        .channel('public:audios')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audios' }, async (payload) => {
            const newAudio = payload.new as any;
            
            // Ignore my own audios
            if (user && newAudio.user_id === user.id) return;

            // Check privacy
            if (newAudio.privacy && newAudio.privacy !== 'public') return;

            try {
                // Get current position
                const position = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                // Calculate distance
                const dist = calculateDistance(userLat, userLng, newAudio.latitude, newAudio.longitude);

                // Notify if within 200m
                if (dist <= 200) {
                    // 1. Local Notification
                    await LocalNotifications.schedule({
                        notifications: [{
                            title: "¡Nuevo Eco cercano!",
                            body: `Alguien ha dejado un eco cerca de ti: "${newAudio.title}"`,
                            id: new Date().getTime(),
                            schedule: { at: new Date(Date.now() + 100) },
                            sound: undefined,
                            attachments: undefined,
                            actionTypeId: "",
                            extra: {
                                audioId: newAudio.id
                            }
                        }]
                    });

                    // 2. Persist in Database
                    try {
                        await supabase.from('notifications').insert({
                            user_id: user.id,
                            actor_id: newAudio.user_id,
                            type: 'proximity',
                            entity_id: newAudio.id, // Store audio ID
                            read: false,
                            // Store title in metadata if needed, but we can fetch it or just use generic text
                            // If the table has a metadata column (JSONB), we can use it:
                            // metadata: { title: newAudio.title } 
                        });
                    } catch (dbError) {
                        console.error("Error persisting notification:", dbError);
                    }
                }
            } catch (error) {
                console.error("Error processing new audio notification:", error);
            }
        })
        .subscribe();

      if (!user) return; // The rest require being logged in

      // 3. Subscribe to ALL USER NOTIFICATIONS (Follows, Likes, Comments, Requests)
      myNotificationsSubscription = supabase
        .channel(`user-notifications:${user.id}`)
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            const notif = payload.new as any;
            
            // Fetch actor details
            const { data: actor } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', notif.actor_id)
                .single();
            
            const actorName = actor?.username ? `@${actor.username}` : 'Alguien';
            
            let title = 'Nueva notificación';
            let body = 'Tienes una nueva notificación';
            
            switch (notif.type) {
                case 'follow':
                    title = '¡Nuevo explorador! 🗺️';
                    body = `${actorName} ha comenzado a seguirte.`;
                    break;
                case 'request':
                    title = '¡Solicitud de expedición! 🔒';
                    body = `${actorName} quiere seguirte.`;
                    break;
                case 'like':
                    title = '¡Tu eco resuena! ❤️';
                    body = `A ${actorName} le gustó tu eco.`;
                    break;
                case 'comment':
                    title = '¡Señal recibida! 📡';
                    body = `${actorName} comentó tu eco.`;
                    break;
                case 'admin_msg':
                    title = 'Mensaje del Sistema 🛡️';
                    body = 'Tienes un mensaje importante de los administradores.';
                    break;
            }

            await LocalNotifications.schedule({
                notifications: [{
                    title,
                    body,
                    id: new Date().getTime(),
                    schedule: { at: new Date(Date.now() + 100) },
                    sound: 'beep.wav', // Use system default or custom if available
                    smallIcon: 'ic_stat_icon_config_sample', // Default capacitor icon or app icon
                }]
            });
          }
        )
        .subscribe();
    };

    // Initialize
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setupNotifications(session.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setupNotifications(session.user);
      } else {
        cleanupSubscriptions();
      }
    });

    return () => {
      subscription.unsubscribe();
      cleanupSubscriptions();
    };
  }, []);

  return null;
};
