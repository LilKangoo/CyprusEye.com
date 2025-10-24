import { sb } from '/js/supabaseClient.js'

const xpEl  = document.querySelector('[data-xp]')
const lvlEl = document.querySelector('[data-level]')

init()

async function init(){
  const { data: { session } } = await sb.auth.getSession()
  const user = session?.user
  if (user) {
    await loadProfile(user.id)
    subscribeProfile(user.id)
  }

  // uniwersalny handler przycisków +XP
  document.querySelectorAll('[data-award]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [type, id] = (btn.dataset.award || '').split('|')
      if (!type || !id) return
      if (type === 'visit_poi') await awardPoi(id)
      if (type === 'task')      await awardTask(id)
    })
  })
}

async function loadProfile(userId){
  const { data, error } = await sb.from('profile_basic').select('*').eq('id', userId).single()
  if (!error && data) updateUi(data)
}

function subscribeProfile(userId){
  sb.channel('profile-rt')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      payload => updateUi(payload.new))
    .subscribe()
}

function updateUi(p){
  if (xpEl)  xpEl.textContent  = p.xp
  if (lvlEl) lvlEl.textContent = p.level
}

// publiczne utilsy do wywołań z innych modułów
export async function awardPoi(poiId){
  const { error } = await sb.rpc('award_poi',  { p_poi_id: poiId })
  if (error) console.error('award_poi:', error.message)
}

export async function awardTask(taskId){
  const { error } = await sb.rpc('award_task', { p_task_id: taskId })
  if (error) console.error('award_task:', error.message)
}
