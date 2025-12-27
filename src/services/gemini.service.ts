
import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly ai: GoogleGenAI;

  constructor() {
    // Initialize the client with the API key from the environment
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  }

  /**
   * Generates an image based on the prompt using Imagen 3.
   * Returns a base64 data URL.
   */
  async generateImage(prompt: string): Promise<string> {
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9', // Default to cinematic aspect ratio
        },
      });

      if (!response.generatedImages?.[0]?.image?.imageBytes) {
        throw new Error('Nenhuma imagem foi gerada.');
      }

      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Generates a video based on the prompt using Veo.
   * Handles polling and downloading the video blob.
   * Returns a Blob URL string.
   */
  async generateVideo(prompt: string): Promise<string> {
    try {
      // 1. Start generation operation
      let operation = await this.ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
          numberOfVideos: 1
        }
      });

      // 2. Poll until complete
      while (!operation.done) {
        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await this.ai.operations.getVideosOperation({ operation: operation });
      }

      // 3. Get download link
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error('Falha ao obter link do vídeo gerado.');
      }

      // 4. Fetch the actual video content
      // Appending the API key is required for the download link
      const response = await fetch(`${downloadLink}&key=${process.env['API_KEY']}`);
      
      if (!response.ok) {
        // Try to read error body if possible
        let errBody = '';
        try { errBody = await response.text(); } catch {}
        throw new Error(`Falha ao baixar o arquivo de vídeo (${response.status}). ${errBody}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);

    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any): never {
    console.error('GenAI Service Error:', error);

    let message = '';
    
    // Extract message from various possible formats
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Handle the raw object structure like {"error": ...}
      if (error.error?.message) {
        message = error.error.message;
      } else {
        // Fallback: try to stringify, but be careful of circular refs
        try {
          message = JSON.stringify(error);
        } catch {
          message = 'Erro desconhecido (objeto não serializável)';
        }
      }
    } else {
      message = String(error);
    }

    // Check for specific keywords related to quotas
    if (
      message.includes('429') || 
      message.includes('RESOURCE_EXHAUSTED') ||
      (typeof error === 'object' && (error?.status === 429 || error?.error?.code === 429))
    ) {
      throw new Error('Limite de cota excedido (Erro 429). A sua conta atingiu o limite de requisições do GenAI. Por favor, aguarde um momento antes de tentar novamente.');
    }

    // Throw a clean Error object with the best message we found
    throw new Error(message || 'Ocorreu um erro desconhecido.');
  }
}
