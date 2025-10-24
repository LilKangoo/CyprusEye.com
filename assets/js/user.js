import { sb } from '/assets/js/sb.js';

const xpNodes = Array.from(document.querySelectorAll('[data-xp]'));
const levelNodes = Array.from(document.querySelectorAll('[data-level]'));
const loginButtons = Array.from(document.querySelectorAll('[data-login]'));
const logoutButtons = Array.from(document.querySelectorAll('[data-logout]'));
const guestButtons = Array.from(document.querySelectorAll('[data-guest]'));
const awardButtons = Array.from(document.querySelectorAll('[data-award]'));

let activeChannel = null;
let activeUserId = null;
let latestProfile = null;

init().catch((error) => {
  console.error('[SB_USER] Nie udało się zainicjować modułu użytkownika.', error);
});

async function init() {
  await hydrateFromCurrentSession();
  sb.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user ?? null;
    renderAuth(user);
    if (!user?.id) {
      await teardownChannel();
      clearProfile();
      return;
    }

    await bootstrapProfile(user.id);
  });

  loginButtons.forEach((button) => {
    button.addEventListener('click', () => {
      window.location.href = '/auth/';
    });
  });

  logoutButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await sb.auth.signOut();
      } catch (error) {
        console.error('[SB_USER] Nie udało się wylogować użytkownika.', error);
      }
    });
  });

  guestButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      await sb.auth.signOut().catch(() => {});
      await teardownChannel();
      clearProfile();
      renderAuth(null);
    });
  });

  awardButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const descriptor = (button.dataset.award || '').trim();
      if (!descriptor) {
        return;
      }

      const [eventKey, reason] = descriptor.split('|');
      if (!eventKey) {
        return;
      }

      try {
        const { error } = await sb.rpc('award_xp', {
          p_event: eventKey,
          p_reason: reason || null,
        });
        if (error) {
          console.error('[SB_USER] award_xp zwróciło błąd.', error);
        }
      } catch (error) {
        console.error('[SB_USER] Nie udało się wywołać award_xp.', error);
      }
    });
  });
}

async function hydrateFromCurrentSession() {
  try {
    const {
      data: { session },
      error,
    } = await sb.auth.getSession();
    if (error) {
      throw error;
    }
    const user = session?.user ?? null;
    renderAuth(user);
    if (user?.id) {
      await bootstrapProfile(user.id);
    } else {
      clearProfile();
    }
  } catch (error) {
    console.error('[SB_USER] Nie udało się pobrać bieżącej sesji.', error);
    renderAuth(null);
    clearProfile();
  }
}

async function bootstrapProfile(userId) {
  if (!userId) {
    return;
  }

  if (activeUserId === userId && activeChannel) {
    return;
  }

  await teardownChannel();
  activeUserId = userId;

  try {
    const { data, error } = await sb
      .from('profile_basic')
      .select('id, xp, level')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    if (data) {
      updateProfile(data);
    }
  } catch (error) {
    console.error('[SB_USER] Nie udało się pobrać profilu.', error);
  }

  try {
    const channel = sb
      .channel(`profile-watch-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          if (payload?.new) {
            updateProfile(payload.new);
          }
        }
      );

    activeChannel = channel;
    await channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[SB_USER] Kanał Realtime zgłosił błąd.');
      }
      if (status === 'CLOSED') {
        if (activeChannel === channel) {
          activeChannel = null;
        }
      }
    });
  } catch (error) {
    console.error('[SB_USER] Nie udało się utworzyć subskrypcji profilu.', error);
  }
}

async function teardownChannel() {
  if (!activeChannel) {
    activeUserId = null;
    return;
  }

  try {
    await sb.removeChannel(activeChannel);
  } catch (error) {
    console.warn('[SB_USER] Nie udało się usunąć kanału profilu.', error);
  }

  activeChannel = null;
  activeUserId = null;
}

function renderAuth(user) {
  const isLoggedIn = Boolean(user && user.id);
  document.documentElement.dataset.auth = isLoggedIn ? 'in' : 'out';

  loginButtons.forEach((button) => {
    button.style.display = isLoggedIn ? 'none' : '';
  });

  logoutButtons.forEach((button) => {
    button.style.display = isLoggedIn ? '' : 'none';
  });

  guestButtons.forEach((button) => {
    button.style.display = isLoggedIn ? 'none' : '';
  });
}

function updateProfile(profile) {
  const xpValue = Number(profile?.xp);
  const levelValue = Number(profile?.level);

  latestProfile = {
    xp: Number.isFinite(xpValue) ? xpValue : 0,
    level: Number.isFinite(levelValue) ? levelValue : 1,
  };

  xpNodes.forEach((node) => {
    node.textContent = String(latestProfile.xp);
  });

  levelNodes.forEach((node) => {
    node.textContent = String(latestProfile.level);
  });
}

function clearProfile() {
  latestProfile = { xp: 0, level: 1 };
  xpNodes.forEach((node) => {
    node.textContent = '0';
  });
  levelNodes.forEach((node) => {
    node.textContent = '1';
  });
}
