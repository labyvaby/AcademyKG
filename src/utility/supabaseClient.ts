/**
 * Supabase клиент отключён — проект мигрирован на Academy KG REST API.
 * Заглушка поддерживает бесконечную цепочку методов и возвращает пустые данные.
 */

const noopVoid = () => {};

// Создаёт объект, который является одновременно Promise и цепочкой методов Supabase
function makeChain(): any {
  const result = { data: null, error: null, count: 0 };
  const promise = Promise.resolve(result);

  // Все методы Supabase query builder возвращают новую цепочку
  const chain: any = new Proxy(promise, {
    get(target: any, prop: string) {
      // Promise методы
      if (prop === 'then') return target.then.bind(target);
      if (prop === 'catch') return target.catch.bind(target);
      if (prop === 'finally') return target.finally.bind(target);
      // Любой другой метод — возвращает функцию которая возвращает новую цепочку
      return (..._args: any[]) => makeChain();
    },
  });

  return chain;
}

export const supabase: any = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signInWithPassword: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
    signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
    verifyOtp: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
    updateUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: noopVoid } } }),
  },
  from: (_table: string) => makeChain(),
  schema: (_s: string) => ({ from: (_table: string) => makeChain() }),
  rpc: (_fn: string, _args?: any) => Promise.resolve({ data: null, error: null }),
  functions: {
    invoke: (_fn: string, _opts?: any) => Promise.resolve({ data: null, error: null }),
  },
  channel: (_name: string) => ({
    on: () => ({ subscribe: noopVoid }),
    subscribe: noopVoid,
    unsubscribe: noopVoid,
  }),
  storage: {
    from: (_bucket: string) => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      download: () => Promise.resolve({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      remove: () => Promise.resolve({ data: null, error: null }),
      list: () => Promise.resolve({ data: [], error: null }),
    }),
  },
  removeAllChannels: noopVoid,
  removeChannel: noopVoid,
};
