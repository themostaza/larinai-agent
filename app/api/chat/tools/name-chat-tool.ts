import { tool } from 'ai';
import { z } from 'zod';

export const giveNameToCurrentChatTool = tool({
  description: `
  Assegna un nome/titolo alla chat corrente quando ritieni sia il momento appropriato.
  Usa questo tool quando la conversazione ha sviluppato un tema specifico e merita un titolo descrittivo.
  Il nome deve essere molto breve e catchy, come un titolo di articolo.
  `,
  inputSchema: z.object({
    title: z.string().describe('Il titolo breve e descrittivo da assegnare alla chat (massimo 50 caratteri)')
  }),
  execute: async ({ title }) => {
    console.log(`🏷️ [NAME-TOOL] ============ TOOL EXECUTION START ============`);
    console.log(`🏷️ [NAME-TOOL] Assigning title to current chat: "${title}"`);
    console.log(`🏷️ [NAME-TOOL] Timestamp: ${new Date().toISOString()}`);
    
    try {
      console.log(`🏷️ [NAME-TOOL] Making fetch request to /api/chat/name`);
      
      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const apiUrl = `${baseUrl}/api/chat/name`;
      console.log(`🏷️ [NAME-TOOL] Using API URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim().slice(0, 50) // Assicuriamoci che sia massimo 50 caratteri
        })
      });

      console.log(`🏷️ [NAME-TOOL] Response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`🏷️ [NAME-TOOL] Response not ok: ${response.status} ${response.statusText}`);
        return {
          title,
          error: `HTTP ${response.status}: ${response.statusText}`,
          success: false
        };
      }

      const result = await response.json();
      console.log(`🏷️ [NAME-TOOL] Parsed result:`, { success: result.success, title: result.title });

      if (!result.success) {
        console.log(`🏷️ [NAME-TOOL] Title assignment failed:`, result.error);
        return {
          title,
          error: result.error,
          success: false
        };
      }

      console.log(`🏷️ [NAME-TOOL] Title assigned successfully`);
      return {
        title: result.title,
        sessionId: result.sessionId,
        success: true
      };

    } catch (error) {
      console.error('🏷️ [NAME-TOOL] Error calling name API:', error);
      const errorResult = {
        title,
        error: `Errore nella chiamata API: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        success: false
      };
      console.log(`🏷️ [NAME-TOOL] Returning error result:`, errorResult);
      return errorResult;
    }
  },
});
