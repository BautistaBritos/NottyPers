/**
 * Calcula los segundos restantes hasta las 6:00 AM de Argentina.
 * No importa si el servidor está en USA, Europa o Local.
 */
export const getSecondsUntil6AMArgentina = (): number => {
  // 1. Obtenemos la fecha actual en la zona horaria de Argentina
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));

  // 2. Creamos el objetivo: las 6 AM de hoy en Argentina
  const target = new Date(argentinaTime);
  target.setHours(6, 0, 0, 0);

  // 3. Si ya pasaron las 6 AM en Argentina, apuntamos a las 6 AM de mañana
  if (argentinaTime >= target) {
    target.setDate(target.getDate() + 1);
  }

  // 4. Calculamos la diferencia
  // IMPORTANTE: Como trabajamos con objetos Date ajustados, la diferencia es precisa
  const diffInMilliseconds = target.getTime() - argentinaTime.getTime();
  
  // Retornamos los segundos (mínimo 1 segundo para evitar errores en Redis)
  return Math.max(Math.floor(diffInMilliseconds / 1000), 1);
};

export const getSecondsUntil10PMArgentina = (): number => {
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));

  const target = new Date(argentinaTime);
  target.setHours(22, 0, 0, 0); // 10 PM

  // Si ya pasaron las 10 PM, apuntamos a las 10 PM de mañana
  if (argentinaTime >= target) {
    target.setDate(target.getDate() + 1);
  }

  const diffInMilliseconds = target.getTime() - argentinaTime.getTime();
  const seconds = Math.max(Math.floor(diffInMilliseconds / 1000), 1);

  console.log(`🧪 TEST TTL: Faltan ${seconds} segundos para las 10 PM Arg.`);
  return seconds;
};