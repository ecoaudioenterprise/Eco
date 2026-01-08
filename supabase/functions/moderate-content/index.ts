// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import OpenAI from "openai";
// @ts-ignore
import { Resend } from "resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  // @ts-ignore
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Using Groq instead of OpenAI (Free API)
  // @ts-ignore
  const groqKey = Deno.env.get('GROQ_API_KEY');
  // @ts-ignore
  const resendKey = Deno.env.get('RESEND_API_KEY');

  // Simple token generation/verification for email links
  const generateToken = async (id: string) => {
    const msgUint8 = new TextEncoder().encode(id + "soundspot-moderation-secret");
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // --- HANDLE GET REQUESTS (Actions from Email) ---
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const token = url.searchParams.get('token');

    if (!id || !action || !token) {
      return new Response("Missing parameters", { status: 400 });
    }

    const expectedToken = await generateToken(id);
    if (token !== expectedToken) {
      return new Response("Invalid token", { status: 403 });
    }

    if (action === 'delete') {
      // Delete from DB (Storage deletion usually handled by triggers or manual cleanup)
      // 1. Get audio to find storage path if needed (or just delete row and rely on cascade)
      const { data: audio } = await supabase.from('audios').select('*').eq('id', id).single();
      
      if (audio) {
          // Delete from Storage (assuming bucket is 'audio-uploads' or similar)
          // We'd need to parse the path from audioUrl. 
          // For now, let's just delete the record.
          await supabase.from('audios').delete().eq('id', id);
          
          return new Response(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Eco Eliminado</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        background-color: #f3f4f6;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: white;
                        padding: 2rem;
                        border-radius: 1rem;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        text-align: center;
                        max-width: 400px;
                        width: 90%;
                    }
                    .icon {
                        color: #ef4444;
                        font-size: 4rem;
                        margin-bottom: 1rem;
                    }
                    h1 {
                        color: #111827;
                        font-size: 1.5rem;
                        margin-bottom: 0.5rem;
                    }
                    p {
                        color: #6b7280;
                        margin-bottom: 1.5rem;
                        line-height: 1.5;
                    }
                    .button {
                        display: inline-block;
                        background-color: #3b82f6;
                        color: white;
                        padding: 0.75rem 1.5rem;
                        border-radius: 0.5rem;
                        text-decoration: none;
                        font-weight: 500;
                        transition: background-color 0.2s;
                    }
                    .button:hover {
                        background-color: #2563eb;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">🗑️</div>
                    <h1>Eco Eliminado</h1>
                    <p>El audio ha sido eliminado correctamente del sistema y ya no estará disponible.</p>
                </div>
            </body>
            </html>
          `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
      } else {
         return new Response("Audio not found (already deleted?)", { status: 404 });
      }
    }

    if (action === 'keep') {
        // Mark as safe explicitly
        await supabase.from('audios').update({ moderation_status: 'safe' }).eq('id', id);
        return new Response(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Eco Aprobado</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        background-color: #f3f4f6;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: white;
                        padding: 2rem;
                        border-radius: 1rem;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        text-align: center;
                        max-width: 400px;
                        width: 90%;
                    }
                    .icon {
                        color: #22c55e;
                        font-size: 4rem;
                        margin-bottom: 1rem;
                    }
                    h1 {
                        color: #111827;
                        font-size: 1.5rem;
                        margin-bottom: 0.5rem;
                    }
                    p {
                        color: #6b7280;
                        margin-bottom: 1.5rem;
                        line-height: 1.5;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✅</div>
                    <h1>Eco Aprobado</h1>
                    <p>El audio ha sido marcado como seguro y permanecerá en el sistema.</p>
                </div>
            </body>
            </html>
          `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    }

    return new Response("Invalid action", { status: 400 });
  }

  // --- HANDLE POST REQUESTS (Webhooks) ---
  if (req.method === 'POST') {
    let payload: any = null;
    try {
        if (!groqKey || !resendKey) {
            console.error("Missing API Keys");
            return new Response(JSON.stringify({ error: "Configuration missing" }), { 
                status: 500, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        payload = await req.json();
        const { record } = payload;

        // Only process if it's a new insert or status is pending
        // And ensure we have an audioUrl
        if (!record || !record.file_url) {
             return new Response(JSON.stringify({ message: "No audio record found" }), { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        // Avoid loops
        if (record.moderation_status && record.moderation_status !== 'pending') {
             return new Response(JSON.stringify({ message: "Already processed" }), { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        // Initialize Groq client (OpenAI compatible)
        const groq = new OpenAI({ 
            apiKey: groqKey,
            baseURL: 'https://api.groq.com/openai/v1'
        });
        const resend = new Resend(resendKey);

        // 1. Transcribe (to get text for moderation)
        // We need to fetch the file first
        console.log("Fetching audio from:", record.file_url);
        const audioResponse = await fetch(record.file_url);
        if (!audioResponse.ok) throw new Error("Failed to fetch audio file");
        
        const blob = await audioResponse.blob();
        
        // Convert Blob to File object for OpenAI/Groq
        const file = new File([blob], "audio.mp3", { type: "audio/mp3" });

        console.log("Transcribing with Groq...");
        let transcriptText = "";
        try {
            const transcription = await groq.audio.transcriptions.create({
                file: file,
                model: "whisper-large-v3", // Groq's supported model
                response_format: "json",
                language: "es", // Optimize for Spanish
            });
            transcriptText = transcription.text;
        } catch (error: unknown) {
             console.error("Groq Transcription Error:", error);
             // Fail open if quota exceeded or other API error
             const err = error as any;
             if (err?.status === 429 || err?.code === 'insufficient_quota') {
                 console.warn("Groq Quota Exceeded (Transcription). Sending admin email.");
                 
                 // Generate tokens for admin actions
                 const token = await generateToken(record.id);
                 const projectRef = supabaseUrl.split('https://')[1].split('.')[0];
                 const functionUrl = `https://${projectRef}.supabase.co/functions/v1/moderate-content`;
                 
                 const deleteLink = `${functionUrl}?id=${record.id}&action=delete&token=${token}`;
                 const keepLink = `${functionUrl}?id=${record.id}&action=keep&token=${token}`;

                 await supabase.from('audios').update({
                    moderation_status: 'flagged', // Mark as flagged so it's not immediately public/safe
                    moderation_reason: 'Revisión manual requerida: Cuota Groq excedida',
                    transcript: '(Transcripción no disponible por falta de cuota)'
                }).eq('id', record.id);

                // Send email to admin
                await resend.emails.send({
                    from: 'Eco Admin <onboarding@resend.dev>',
                    to: 'ecoaudios@gmail.com',
                    subject: '⚠️ Alerta: Cuota Groq Excedida - Revisión Manual Requerida',
                    html: `
                        <h2>La cuota de Groq se ha agotado</h2>
                        <p>Un usuario ha subido un audio y no hemos podido moderarlo automáticamente.</p>
                        <p><strong>Audio ID:</strong> ${record.id}</p>
                        <p><strong>URL del Audio:</strong> <a href="${record.file_url}">Escuchar Audio</a></p>
                        
                        <h3>Acciones Rápidas:</h3>
                        <p>
                            <a href="${keepLink}" style="background-color: green; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">✅ Aprobar (Es seguro)</a>
                            <a href="${deleteLink}" style="background-color: red; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;">❌ Borrar (Inapropiado)</a>
                        </p>
                    `
                });

                return new Response(JSON.stringify({ message: "Quota exceeded, admin notified" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
             }
             throw error;
        }

        console.log("Transcript:", transcriptText);

        // 2. Moderate Text using Llama 3 (via Chat Completion)
        console.log("Moderating with Groq (Llama 3)...");
        let completion;
        try {
            completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "Eres un sistema de moderación de contenido. Analiza el siguiente texto transcrito de un audio. Tu tarea es identificar si contiene contenido inapropiado severo: discurso de odio, acoso grave, violencia explícita, autolesiones o contenido sexual explícito. Sé razonable: el lenguaje coloquial o las palabrotas leves NO deben ser marcadas. Solo marca contenido verdaderamente dañino o ilegal. Devuelve UNICAMENTE un objeto JSON con la estructura: { \"flagged\": boolean, \"categories\": { \"hate\": boolean, \"harassment\": boolean, \"sexual\": boolean, \"violence\": boolean }, \"reason\": string | null }."
                    },
                    {
                        role: "user",
                        content: transcriptText
                    }
                ],
                model: "llama-3.1-8b-instant", // New supported model
                response_format: { type: "json_object" },
                temperature: 0,
            });
        } catch (error: unknown) {
             console.error("Groq Moderation Error:", error);
             // Fail open if quota exceeded
             const err = error as any;
             if (err?.status === 429 || err?.code === 'insufficient_quota') {
                 console.warn("Groq Quota Exceeded (Moderation). Sending admin email.");
                 
                 // Generate tokens for admin actions
                 const token = await generateToken(record.id);
                 const projectRef = supabaseUrl.split('https://')[1].split('.')[0];
                 const functionUrl = `https://${projectRef}.supabase.co/functions/v1/moderate-content`;
                 
                 const deleteLink = `${functionUrl}?id=${record.id}&action=delete&token=${token}`;
                 const keepLink = `${functionUrl}?id=${record.id}&action=keep&token=${token}`;

                 await supabase.from('audios').update({
                    moderation_status: 'flagged', // Mark as flagged
                    moderation_reason: 'Revisión manual requerida: Cuota Groq excedida (Mod)',
                    transcript: transcriptText
                }).eq('id', record.id);

                // Send email to admin
                await resend.emails.send({
                    from: 'SoundSpot Security <onboarding@resend.dev>',
                    to: 'ecoaudioenterprise@gmail.com',
                    subject: '⚠️ Alerta: Cuota Groq Excedida - Revisión Manual Requerida',
                    html: `
                        <h2>La cuota de Groq se ha agotado</h2>
                        <p>Un usuario ha subido un audio y la transcripción fue exitosa, pero no pudimos moderarlo.</p>
                        <p><strong>Audio ID:</strong> ${record.id}</p>
                        <p><strong>Transcripción:</strong> "${transcriptText}"</p>
                        <p><strong>URL del Audio:</strong> <a href="${record.file_url}">Escuchar Audio</a></p>
                        
                        <h3>Acciones Rápidas:</h3>
                        <p>
                            <a href="${keepLink}" style="background-color: green; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">✅ Aprobar (Es seguro)</a>
                            <a href="${deleteLink}" style="background-color: red; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;">❌ Borrar (Inapropiado)</a>
                        </p>
                    `
                });

                return new Response(JSON.stringify({ message: "Quota exceeded, admin notified" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
             }
             throw error;
        }

        const resultJson = JSON.parse(completion.choices[0].message.content || "{}");
        console.log("Moderation Result:", JSON.stringify(resultJson));
        const isFlagged = resultJson.flagged || false;
        
        // 3. Update Database
        const status = isFlagged ? 'flagged' : 'safe';
        const reason = isFlagged ? (resultJson.reason || "Contenido inapropiado detectado por IA") : null;

        await supabase.from('audios').update({
            moderation_status: status,
            moderation_reason: reason,
            transcript: transcriptText
        }).eq('id', record.id);

        // 4. Send Email if Flagged
        if (isFlagged) {
            console.log("Flagged! Sending email...");
            
            // Generate Action Links
            const token = await generateToken(record.id);
            // Construct Function URL (Assuming standard supabase project structure)
            // https://<project_ref>.supabase.co/functions/v1/moderate-content
            // We can try to infer it or use a configured var. 
            // For now, we'll try to use the origin of the request if possible, or construct it.
            // But in a webhook, the request origin is Supabase internal.
            // We'll rely on SUPABASE_URL to extract project ref.
            
            const projectRef = supabaseUrl.split('https://')[1].split('.')[0];
            const functionUrl = `https://${projectRef}.supabase.co/functions/v1/moderate-content`;
            
            const deleteLink = `${functionUrl}?id=${record.id}&action=delete&token=${token}`;
            const keepLink = `${functionUrl}?id=${record.id}&action=keep&token=${token}`;

            const { data, error } = await resend.emails.send({
                    from: 'Eco Admin <onboarding@resend.dev>', // Update this if user has custom domain
                    to: ['ecoaudioenterprise@gmail.com'], // Hardcoded to user's email for now, or fetch from admins table
                    subject: `⚠️ Alerta de Moderación: Eco Detectado (${reason})`,
                html: `
                    <h1>Contenido Sospechoso Detectado</h1>
                    <p>Un nuevo eco ha sido marcado por la IA por posible incumplimiento de políticas.</p>
                    
                    <div style="background: #f4f4f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <p><strong>ID:</strong> ${record.id}</p>
                        <p><strong>Título:</strong> ${record.title || 'Sin título'}</p>
                        <p><strong>Autor:</strong> ${record.author || 'Anónimo'}</p>
                        <p><strong>Motivo:</strong> ${reason}</p>
                        <p><strong>Transcripción:</strong> <i>"${transcriptText}"</i></p>
                    </div>

                    <h3>Escuchar Eco:</h3>
                    <audio controls src="${record.file_url}"></audio>
                    <p><a href="${record.file_url}">Enlace directo al audio</a></p>

                    <h3>Acciones:</h3>
                    <div style="display: flex; gap: 10px;">
                        <a href="${deleteLink}" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">🗑️ Eliminar Eco</a>
                        <a href="${keepLink}" style="background: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">✅ Mantener (Falso Positivo)</a>
                    </div>
                `
            });
            
            if (error) console.error("Error sending email:", error);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            flagged: isFlagged,
            transcript: transcriptText 
        }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error: any) {
        console.error("Error in moderation function:", error);

        // Handle OpenAI Quota/Rate Limit Errors gracefully (Fail Open)
        if (error?.status === 429 || error?.code === 'insufficient_quota') {
            console.warn("OpenAI Quota Exceeded. Marking content as safe to prevent blockage.");
            
            if (payload?.record?.id) {
                // Mark as safe but note the reason
                await supabase.from('audios').update({
                    moderation_status: 'safe',
                    moderation_reason: 'Moderación omitida: Cuota OpenAI excedida',
                    transcript: '(Transcripción no disponible por falta de cuota)'
                }).eq('id', payload.record.id);
            }

            // Optional: Notify admin via email about the outage (using Resend if available)
            if (resendKey) {
                const resend = new Resend(resendKey);
                await resend.emails.send({
                    from: 'Eco Admin <onboarding@resend.dev>',
                    to: ['ecoaudioenterprise@gmail.com'],
                    subject: '⚠️ Error de Sistema: Cuota OpenAI Excedida',
                    html: `
                        <h1>La moderación automática ha fallado</h1>
                        <p>El servicio de OpenAI ha devuelto un error de cuota excedida (429).</p>
                        <p><strong>Acción tomada:</strong> El eco ID ${payload?.record?.id || 'Desconocido'} se ha marcado como SEGURO automáticamente para no interrumpir el servicio.</p>
                        <p>Por favor, revisa tu facturación en OpenAI.</p>
                    `
                });
            }

            return new Response(JSON.stringify({ 
                success: true, 
                warning: "Quota exceeded, skipped moderation" 
            }), { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
