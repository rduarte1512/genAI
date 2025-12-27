
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO ---
// Credenciais configuradas
const SUPABASE_URL = 'https://lmsqdxrkwjbiqrppsszi.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_VdLvwbbydIdGSUNa4_u_vw_vhsB2e0V';

export interface UserProfile {
  id: string;
  name: string;
  credits: number;
  tier: 'free' | 'basic' | 'pro';
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    // Inicializa o cliente com as chaves fornecidas
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  get isConfigured(): boolean {
    return !!SUPABASE_URL && !!SUPABASE_KEY;
  }

  // --- Auth ---

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, full_name: name } // Guarda o nome nos metadados
      }
    });
    
    if (error) throw error;

    // Se o registo for bem sucedido, criar o perfil na tabela 'profiles'
    if (data.user) {
      // Tenta criar o perfil. Se já existir (devido a triggers), ignora.
      const { error: profileError } = await this.supabase.from('profiles').upsert({
        id: data.user.id,
        name: name,
        credits: 30, // Créditos iniciais
        tier: 'free'
      }, { onConflict: 'id', ignoreDuplicates: true });
      
      if (profileError) console.error('Erro ao criar perfil:', profileError);
    }

    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  // --- Data ---

  async getProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    // PGRST116 significa "nenhuma linha encontrada", retornamos null nesse caso
    if (error && error.code !== 'PGRST116') throw error;
    return data as UserProfile;
  }

  async updateCredits(userId: string, newAmount: number) {
    const { error } = await this.supabase
      .from('profiles')
      .update({ credits: newAmount })
      .eq('id', userId);
    if (error) throw error;
  }

  async updateTier(userId: string, tier: string, credits: number) {
     const { error } = await this.supabase
      .from('profiles')
      .update({ tier: tier, credits: credits })
      .eq('id', userId);
    if (error) throw error;
  }

  // --- Folders ---

  async getFolders(userId: string) {
    const { data, error } = await this.supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createFolder(userId: string, name: string) {
    const { data, error } = await this.supabase
      .from('folders')
      .insert({ user_id: userId, name: name })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteFolder(id: number) {
    const { error } = await this.supabase
      .from('folders')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // --- History ---

  async getHistory(userId: string) {
    const { data, error } = await this.supabase
      .from('history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    return data.map((item: any) => ({
      ...item,
      folderId: item.folder_id,
      timestamp: new Date(item.created_at)
    }));
  }

  async addToHistory(userId: string, type: string, prompt: string, url: string, cost: number) {
    const { data, error } = await this.supabase
      .from('history')
      .insert({
        user_id: userId,
        type,
        prompt,
        url, 
        cost
      })
      .select()
      .single();
      
    if (error) throw error;
    return {
      ...data,
      folderId: data.folder_id,
      timestamp: new Date(data.created_at)
    };
  }

  async moveItemToFolder(itemId: number, folderId: number | null) {
    const { error } = await this.supabase
      .from('history')
      .update({ folder_id: folderId })
      .eq('id', itemId);
    if (error) throw error;
  }

  async deleteHistoryItem(itemId: number) {
    const { error } = await this.supabase
      .from('history')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  }
}
