import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kyjtylqrvqvpyxsfmpzr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5anR5bHFydnF2cHl4c2ZtcHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDMxMjgsImV4cCI6MjA4NjkxOTEyOH0.gpM_nih4nAOf_ZIAIyD8oyDqWTbhQ7WqeNGFg-PZ3ac';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);