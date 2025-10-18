let currentSession = null;
const listeners = new Set();

function broadcast(event) {
  for (const handler of listeners) {
    try {
      handler(event, currentSession);
    } catch (error) {
      console.error('supabase stub handler error', error);
    }
  }
}

export function createClient() {
  return {
    auth: {
      async getSession() {
        return { data: { session: currentSession }, error: null };
      },
      async signInWithPassword({ email }) {
        currentSession = {
          user: {
            id: 'mock-user-id',
            email,
          },
        };
        broadcast('SIGNED_IN');
        return { data: { session: currentSession }, error: null };
      },
      async signUp({ email }) {
        return {
          data: { user: { id: 'mock-user-id', email } },
          error: null,
        };
      },
      async signOut() {
        currentSession = null;
        broadcast('SIGNED_OUT');
        return { error: null };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null };
      },
      onAuthStateChange(callback) {
        listeners.add(callback);
        callback('INITIAL_SESSION', currentSession);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback);
              },
            },
          },
          error: null,
        };
      },
    },
    from() {
      return {
        select: async () => ({ data: null, error: null }),
      };
    },
  };
}
