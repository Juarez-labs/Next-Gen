export type Locale = "es" | "en";

export const STRINGS = {
  appName: { es: "Lotería Familiar", en: "Family Lotería" },
  signIn: { es: "Iniciar sesión", en: "Sign in" },
  signUp: { es: "Crear cuenta", en: "Sign up" },
  email: { es: "Correo", en: "Email" },
  password: { es: "Contraseña", en: "Password" },
  displayName: { es: "Nombre", en: "Display name" },
  continueWithGoogle: { es: "Continuar con Google", en: "Continue with Google" },
  continueWithApple: { es: "Continuar con Apple", en: "Continue with Apple" },
  or: { es: "o", en: "or" },

  hostGame: { es: "Crear juego", en: "Host a game" },
  joinGame: { es: "Unirme a un juego", en: "Join a game" },
  enterCode: { es: "Ingresa el código", en: "Enter code" },
  scanQR: { es: "Escanear QR", en: "Scan QR" },

  winMode: { es: "Modo de victoria", en: "Win mode" },
  winCorners: { es: "Esquinas", en: "Corners" },
  winRow: { es: "Línea (fila/columna/diagonal)", en: "Row / column / diagonal" },
  winFull: { es: "Tabla llena", en: "Full board" },
  tempo: { es: "Velocidad", en: "Tempo" },
  slow: { es: "Lento", en: "Slow" },
  medium: { es: "Medio", en: "Medium" },
  fast: { es: "Rápido", en: "Fast" },

  start: { es: "Empezar", en: "Start" },
  pause: { es: "Pausar", en: "Pause" },
  resume: { es: "Reanudar", en: "Resume" },
  loteria: { es: "¡LOTERÍA!", en: "LOTERÍA!" },
  winner: { es: "¡Ganador!", en: "Winner!" },
  outForRound: { es: "Fuera de la ronda", en: "Out for the round" },
  falseClaim: { es: "Falsa lotería", en: "False call" },

  customize: { es: "Personalizar cartas", en: "Customize cards" },
  uploadPhoto: { es: "Subir foto", en: "Upload photo" },
  generateWithAI: { es: "Generar con IA", en: "Generate with AI" },
  resetToDefault: { es: "Restaurar", en: "Reset to default" },

  language: { es: "Idioma", en: "Language" },
  spanish: { es: "Español", en: "Spanish" },
  english: { es: "Inglés", en: "English" },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, locale: Locale): string {
  return STRINGS[key][locale];
}
