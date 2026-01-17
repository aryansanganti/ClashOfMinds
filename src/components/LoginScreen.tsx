import React from 'react';
import { useAuth } from '../context/AuthContext';
import { TransparentImage } from '../../components/TransparentImage'; // Assuming relative path adjustment

export const LoginScreen: React.FC = () => {
    const { signInWithGoogle, loading } = useAuth();
    const [isSigningIn, setIsSigningIn] = React.useState(false);

    const handleLogin = async () => {
        if (isSigningIn) return;
        setIsSigningIn(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error("Login Failed", error);
            setIsSigningIn(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20 blur-sm pointer-events-none" />

            <div className="relative z-10 max-w-md w-full bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl text-center">

                {/* Logo / Icon Area */}
                <div className="mb-8">
                    <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl mx-auto shadow-lg flex items-center justify-center text-4xl transform rotate-3 hover:rotate-6 transition-transform duration-500">
                        ⚔️
                    </div>
                </div>

                <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Clash of Minds</h1>
                <p className="text-slate-300 mb-8 text-lg">Battle with knowledge.</p>

                <button
                    onClick={handleLogin}
                    disabled={isSigningIn}
                    className="w-full group relative flex items-center justify-center gap-3 bg-white text-slate-800 hover:bg-slate-50 font-bold py-4 px-6 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSigningIn ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-800" />
                    ) : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            <span>Sign in with Google</span>
                        </>
                    )}
                </button>

                <p className="mt-6 text-xs text-slate-500">
                    By signing in, you agree to enter the arena of wisdom.
                </p>
            </div>
        </div>
    );
};
