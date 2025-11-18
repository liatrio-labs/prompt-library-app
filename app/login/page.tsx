'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) window.location.href = '/';
    });
  }, [supabase]);

  const handleLogin = async () => {
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          hd: 'liatrio.com',
          prompt: 'consent',
          access_type: 'offline'
        }
      }
    });
    if (error) {
      console.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Prompt Library</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Sign in with your @liatrio.com account</p>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium disabled:opacity-60"
        >
          <i className="fab fa-google"></i>
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
