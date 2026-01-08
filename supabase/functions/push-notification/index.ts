import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import admin from "npm:firebase-admin@11.11.0"

// Initialize Firebase Admin with Service Account
// We expect the service account JSON to be in a secret called 'FIREBASE_SERVICE_ACCOUNT'
const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')

if (serviceAccountStr) {
  try {
    const serviceAccount = JSON.parse(serviceAccountStr)
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }
  } catch (e) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', e)
  }
} else {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT secret')
}

serve(async (req) => {
  const { record, type } = await req.json()
  
  // We only care about INSERT events on the notifications table
  if (!record) {
      return new Response("No record found", { status: 400 })
  }

  // 1. Get the target user's FCM token
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', record.user_id)
    .single()

  if (error || !profile?.fcm_token) {
    console.log(`No FCM token for user ${record.user_id}`)
    return new Response(JSON.stringify({ message: "No token found" }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  // 2. Construct the notification payload
  // The 'notifications' table has: title, body (if we added them) or we derive from type
  // Wait, the notifications table schema in `NotificationsManager.tsx` (local) implies we insert raw data.
  // In `fix_follow_error.sql`, we inserted: (user_id, actor_id, type, entity_id)
  // We need to fetch the actor name or use generic text if not present.
  
  // Ideally, we should fetch actor details.
  let title = "Nueva notificación"
  let body = "Tienes una nueva interacción"
  
  if (record.type === 'follow') {
      title = "¡Nuevo seguidor!"
      body = "Alguien ha comenzado a seguirte"
  } else if (record.type === 'comment') {
      title = "Nuevo comentario"
      body = "Alguien comentó en tu eco"
  } else if (record.type === 'like') {
      title = "Me gusta"
      body = "A alguien le gustó tu eco"
  } else if (record.type === 'proximity') {
      title = "¡Eco cercano!"
      body = "Hay un nuevo eco cerca de ti"
  } else if (record.type === 'request') {
      title = "Solicitud de seguimiento"
      body = "Alguien quiere seguirte"
  }

  // If we want more details (like actor name), we need another query.
  if (record.actor_id) {
      const { data: actor } = await supabase.from('profiles').select('username').eq('id', record.actor_id).single()
      if (actor?.username) {
          if (record.type === 'follow') body = `${actor.username} te ha comenzado a seguir`
          if (record.type === 'comment') body = `${actor.username} comentó en tu eco`
          if (record.type === 'like') body = `A ${actor.username} le gustó tu eco`
          if (record.type === 'request') body = `${actor.username} quiere seguirte`
      }
  }

  const message = {
    notification: {
      title,
      body,
    },
    token: profile.fcm_token,
    data: {
        url: 'soundmaps://app', // Custom scheme or deep link
        notificationId: record.id
    }
  }

  try {
    const response = await admin.messaging().send(message)
    console.log('Successfully sent message:', response)
    return new Response(JSON.stringify({ success: true, messageId: response }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
