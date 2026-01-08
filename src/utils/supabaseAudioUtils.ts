import { supabase } from "@/integrations/supabase/client";
import { AudioData } from "./audioStorage";

export const fetchSupabaseAudios = async (options?: { includeAll?: boolean, onProgress?: (progress: number) => void, onCacheLoaded?: (data: AudioData[]) => void }): Promise<AudioData[]> => {
  try {
    // 1. FAST LOAD: Try to load from LocalStorage cache immediately
    if (options?.onCacheLoaded) {
        try {
            const cachedJson = localStorage.getItem('supabase_audios_cache_v1');
            if (cachedJson) {
                const cachedData = JSON.parse(cachedJson);
                
                // We need to re-attach local blob URLs if they exist in IndexedDB
                // This is fast enough to do before showing cache
                import('./audioStorage').then(async ({ getCachedAudioBlob }) => {
                    const cachedWithBlobs = await Promise.all(cachedData.map(async (audio: any) => {
                         const cachedBlob = await getCachedAudioBlob(audio.id);
                         if (cachedBlob) {
                             return {
                                 ...audio,
                                 audioUrl: URL.createObjectURL(cachedBlob)
                             };
                         }
                         return audio;
                    }));
                    options.onCacheLoaded?.(cachedWithBlobs);
                });
            }
        } catch (e) {
            console.error("Error loading cache:", e);
        }
    }

    options?.onProgress?.(10);
    const { data: audiosData, error } = await supabase
      .from('audios')
      .select(`
        *,
        moderation_status,
        moderation_reason,
        profiles:user_id (
          username,
          full_name,
          avatar_url,
          verified
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    options?.onProgress?.(40);

    // Ensure audiosData is an array
    const safeAudiosData = audiosData || [];

    // Filter private/hidden audios logic
    // We need current user ID
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    options?.onProgress?.(50);

    const visibleAudios = options?.includeAll ? safeAudiosData : safeAudiosData.filter((a: any) => {
        const privacy = a.privacy || 'public';
        const authorId = a.user_id;
        
        // Always show my own audios
        if (currentUserId && authorId === currentUserId) return true;
        
        // Show public audios
        if (privacy === 'public') return true;
        
        // Hide hidden and private audios from list (unless I am author, covered above)
        // Hidden audios are only accessible via URL, so they shouldn't appear in the general feed list
        return false;
    });

    // Fetch likes and comments counts separately since FK is missing
    const audioIds = visibleAudios.map((a: any) => a.id);
    
    // Fetch all likes for these audios
    const { data: likesData } = await supabase
        .from('likes')
        .select('audio_id')
        .in('audio_id', audioIds);
    
    options?.onProgress?.(70);

    // Fetch all comments for these audios
    const { data: commentsData } = await supabase
        .from('comments')
        .select('audio_id')
        .in('audio_id', audioIds);

    options?.onProgress?.(85);

    const likesCountMap = new Map();
    likesData?.forEach((l: any) => {
        likesCountMap.set(l.audio_id, (likesCountMap.get(l.audio_id) || 0) + 1);
    });

    const commentsCountMap = new Map();
    commentsData?.forEach((c: any) => {
        commentsCountMap.set(c.audio_id, (commentsCountMap.get(c.audio_id) || 0) + 1);
    });

    let userLikes: Set<string> = new Set();
    
    if (user) {
        const { data: userLikesData } = await supabase
            .from('likes')
            .select('audio_id')
            .eq('user_id', user.id);
        
        if (userLikesData) {
            userLikes = new Set(userLikesData.map(l => l.audio_id));
        }
    }

    options?.onProgress?.(95);

    const result = visibleAudios.map((item: any) => ({
      id: item.id,
      title: item.title,
      author: item.profiles?.full_name || item.profiles?.username || "Usuario",
      authorUsername: item.profiles?.username ? `@${item.profiles.username}` : undefined,
      authorId: item.user_id,
      authorAvatar: item.profiles?.avatar_url,
      authorVerified: item.profiles?.verified,
      distance: "0m", // Calculated in view
      duration: `${Math.floor(item.duration)}s`, // Formatting needed
      likes: likesCountMap.get(item.id) || 0,
      comments: commentsCountMap.get(item.id) || 0,
      category: "story", // Default or add column to DB
      latitude: item.latitude,
      longitude: item.longitude,
      timestamp: new Date(item.created_at).getTime(),
      isLiked: userLikes.has(item.id),
      privacy: item.privacy || 'public',
      audioUrl: item.file_url, // Direct URL or Signed URL
      shouldCache: true, // Flag to trigger caching
      moderation_status: item.moderation_status,
      moderation_reason: item.moderation_reason
    }));

    // We import here to avoid circular dependencies if possible, or just rely on the imported module
    const { saveAudioCache, getCachedAudioBlob } = await import('./audioStorage');
    
    // Modify result to use cached blobs if available
    const audiosWithCache = await Promise.all(result.map(async (audio) => {
        const cachedBlob = await getCachedAudioBlob(audio.id);
        if (cachedBlob) {
            return {
                ...audio,
                audioUrl: URL.createObjectURL(cachedBlob)
            };
        }
        return audio;
    }));

    // Save metadata to localStorage for instant load next time
    try {
        localStorage.setItem('supabase_audios_cache_v1', JSON.stringify(result));
    } catch (e) {
        console.error("Error saving metadata cache", e);
    }

    // Cache audios in background (only those not cached yet)
    cacheAudiosInBackground(result);

    options?.onProgress?.(100);
    return audiosWithCache;
  } catch (error) {
    console.error("Error fetching Supabase audios:", error);
    return [];
  }
};

// New function to cache audios
const cacheAudiosInBackground = async (audios: any[]) => {
    // We import here to avoid circular dependencies if possible, or just rely on the imported module
    const { saveAudioCache } = await import('./audioStorage');
    
    audios.forEach(async (audio) => {
        if (audio.audioUrl) {
            try {
                // Check if already cached (optimization)
                // For now, simple fire and forget logic inside saveAudioCache
                await saveAudioCache(audio.id, audio.audioUrl);
            } catch (e) {
                console.error("Error caching audio", audio.id, e);
            }
        }
    });
};

export const uploadAudioToSupabase = async (blob: Blob, metadata: any) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user logged in");

        // 1. Upload file
        const filename = `${user.id}/${Date.now()}.webm`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('audios')
            .upload(filename, blob);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('audios')
            .getPublicUrl(filename);

        // 3. Insert into DB
        const { data: insertData, error: insertError } = await supabase
            .from('audios')
            .insert({
                title: metadata.title,
                description: metadata.description,
                file_url: publicUrl,
                duration: typeof metadata.duration === 'string' 
                    ? parseFloat(metadata.duration.replace('s', '')) 
                    : metadata.duration,
                latitude: metadata.latitude,
                longitude: metadata.longitude,
                user_id: user.id,
                privacy: 'public', // Force public by default
                color: metadata.color // Add color column
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return insertData;
    } catch (error) {
        console.error("Error uploading audio:", error);
        throw error;
    }
};

export const toggleSupabaseLike = async (audioId: string, isCurrentlyLiked: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Must be logged in");

    if (isCurrentlyLiked) {
        // Unlike
        const { error } = await supabase
            .from('likes')
            .delete()
            .eq('audio_id', audioId)
            .eq('user_id', user.id);
        if (error) throw error;
    } else {
        // Like
        const { error } = await supabase
            .from('likes')
            .insert({
                audio_id: audioId,
                user_id: user.id
            });
            
        if (error) {
            // Ignore duplicate key error (already liked)
            if (error.code === '23505') return;
            throw error;
        }
    }
};
