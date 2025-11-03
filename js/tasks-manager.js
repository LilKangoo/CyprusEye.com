/**
 * Tasks Manager - Zarządzanie zadaniami użytkownika
 * Integracja z Supabase, XP system i UI
 */

import { sb } from './supabaseClient.js';

class TasksManager {
  constructor() {
    this.tasks = [];
    this.completedTaskIds = new Set();
    this.currentUser = null;
    this.tasksListElement = null;
  }

  /**
   * Inicjalizacja managera zadań
   * @param {Array} tasksData - Opcjonalnie przekaż dane zadań
   */
  async init(tasksData = null) {
    console.log('🎯 Initializing Tasks Manager...');
    
    // Pobierz element listy zadań
    this.tasksListElement = document.getElementById('tasksList');
    if (!this.tasksListElement) {
      console.log('ℹ️ Tasks list element not found on this page');
      return;
    }

    // Pobierz dane zadań - najpierw z parametru, potem z window
    this.tasks = tasksData || window.TASKS_DATA || [];
    if (this.tasks.length === 0) {
      console.error('❌ TASKS_DATA not found or empty');
      console.log('Available global variables:', Object.keys(window).filter(k => k.includes('TASKS')));
      return;
    }

    // Pobierz aktualnego użytkownika
    try {
      const { data: { user } } = await sb.auth.getUser();
      this.currentUser = user;
      
      if (user) {
        console.log('✅ User authenticated:', user.id);
        await this.loadCompletedTasks();
      } else {
        console.log('ℹ️ User not authenticated - showing tasks without completion state');
      }
    } catch (error) {
      console.error('Error checking user auth:', error);
    }

    // Wyrenderuj zadania
    this.renderAllTasks();
    
    console.log(`✅ Tasks Manager initialized with ${this.tasks.length} tasks`);
  }

  /**
   * Pobierz ukończone zadania z Supabase
   */
  async loadCompletedTasks() {
    if (!this.currentUser) return;

    try {
      const { data, error } = await sb
        .from('completed_tasks')
        .select('task_id')
        .eq('user_id', this.currentUser.id);

      if (error) {
        console.error('Error loading completed tasks:', error);
        return;
      }

      // Zapisz do Set dla szybkiego sprawdzania
      this.completedTaskIds = new Set(data.map(item => item.task_id));
      console.log(`✅ Loaded ${this.completedTaskIds.size} completed tasks`);
    } catch (error) {
      console.error('Error in loadCompletedTasks:', error);
    }
  }

  /**
   * Renderuj wszystkie zadania
   */
  renderAllTasks() {
    if (!this.tasksListElement) return;

    // Wyczyść listę
    this.tasksListElement.innerHTML = '';

    // Renderuj każde zadanie
    this.tasks.forEach(task => {
      const isCompleted = this.completedTaskIds.has(task.id);
      const taskCard = this.createTaskCard(task, isCompleted);
      this.tasksListElement.appendChild(taskCard);
    });
  }

  /**
   * Utwórz kartę zadania
   */
  createTaskCard(task, isCompleted = false) {
    const li = document.createElement('li');
    li.className = 'task-card card';
    li.dataset.taskId = task.id;
    
    if (isCompleted) {
      li.classList.add('completed');
    }

    // Pobierz tłumaczenia
    const title = this.getTaskTitle(task);
    const description = this.getTaskDescription(task);

    // Tytuł
    const h3 = document.createElement('h3');
    h3.textContent = title;
    h3.className = 'task-title';

    // Opis
    const descP = document.createElement('p');
    descP.textContent = description;
    descP.className = 'task-description';

    // Meta (XP + przycisk)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'task-meta';

    // XP span
    const xpSpan = document.createElement('span');
    xpSpan.className = 'task-xp';
    xpSpan.textContent = `✨ ${task.xp} XP`;

    // Przycisk akcji
    const actionBtn = this.createActionButton(task, isCompleted);

    // Złóż elementy
    metaDiv.appendChild(xpSpan);
    metaDiv.appendChild(actionBtn);

    li.appendChild(h3);
    li.appendChild(descP);
    li.appendChild(metaDiv);

    return li;
  }

  /**
   * Utwórz przycisk akcji (Wykonaj/Cofnij)
   */
  createActionButton(task, isCompleted) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = isCompleted 
      ? 'btn btn-secondary task-action-btn' 
      : 'btn btn-primary task-action-btn';
    button.dataset.taskId = task.id;
    button.dataset.taskXp = task.xp;

    // Tekst przycisku
    if (!this.currentUser) {
      button.textContent = 'Zaloguj się';
      button.disabled = true;
      button.title = 'Musisz być zalogowany, aby ukończyć zadanie';
    } else if (isCompleted) {
      button.textContent = 'Cofnij';
    } else {
      button.textContent = 'Wykonaj';
    }

    // Event listener
    if (this.currentUser) {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          if (isCompleted) {
            await this.undoTask(task, button.closest('.task-card'));
          } else {
            await this.completeTask(task, button.closest('.task-card'));
          }
        } finally {
          button.disabled = false;
        }
      });
    }

    return button;
  }

  /**
   * Ukończ zadanie
   */
  async completeTask(task, cardElement) {
    if (!this.currentUser) {
      this.showToast('Musisz być zalogowany, aby ukończyć zadanie', 'error');
      return;
    }

    console.log('🎯 Completing task:', task.id);

    try {
      // Wstaw do completed_tasks
      const { error: insertError } = await sb
        .from('completed_tasks')
        .insert({
          user_id: this.currentUser.id,
          task_id: task.id
        });

      if (insertError) {
        // Sprawdź czy to duplikat (już ukończone)
        if (insertError.code === '23505') {
          console.log('Task already completed');
          this.completedTaskIds.add(task.id);
          this.updateTaskUI(cardElement, true);
          return;
        }
        throw insertError;
      }

      // Wywołaj RPC function do przyznania XP
      const { error: rpcError } = await sb.rpc('award_task', { 
        p_task_id: task.id 
      });

      if (rpcError) {
        console.error('RPC award_task error:', rpcError);
        // Nie blokuj - zadanie jest zapisane
      }

      // Aktualizuj lokalny stan
      this.completedTaskIds.add(task.id);

      // Aktualizuj UI
      this.updateTaskUI(cardElement, true);

      // Pokaż powiadomienie
      const title = this.getTaskTitle(task);
      this.showToast(`✅ Ukończono: ${title} (+${task.xp} XP)`, 'success');

      // Odśwież statystyki w nagłówku
      await this.refreshUserStats();

      console.log('✅ Task completed successfully');
    } catch (error) {
      console.error('Error completing task:', error);
      this.showToast('Wystąpił błąd podczas ukończenia zadania', 'error');
    }
  }

  /**
   * Cofnij zadanie
   */
  async undoTask(task, cardElement) {
    if (!this.currentUser) return;

    console.log('↩️ Undoing task:', task.id);

    try {
      // Usuń z completed_tasks
      const { error: deleteError } = await sb
        .from('completed_tasks')
        .delete()
        .eq('user_id', this.currentUser.id)
        .eq('task_id', task.id);

      if (deleteError) {
        throw deleteError;
      }

      // Odejmij XP (zaktualizuj profil)
      const { data: profile } = await sb
        .from('profiles')
        .select('xp, level')
        .eq('id', this.currentUser.id)
        .single();

      if (profile) {
        const newXp = Math.max(0, profile.xp - task.xp);
        const newLevel = Math.max(1, Math.floor(newXp / 100) + 1);
        
        await sb
          .from('profiles')
          .update({ 
            xp: newXp,
            level: newLevel,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.currentUser.id);
      }

      // Aktualizuj lokalny stan
      this.completedTaskIds.delete(task.id);

      // Aktualizuj UI
      this.updateTaskUI(cardElement, false);

      // Pokaż powiadomienie
      const title = this.getTaskTitle(task);
      this.showToast(`↩️ Cofnięto: ${title} (-${task.xp} XP)`, 'info');

      // Odśwież statystyki
      await this.refreshUserStats();

      console.log('✅ Task undone successfully');
    } catch (error) {
      console.error('Error undoing task:', error);
      this.showToast('Wystąpił błąd podczas cofania zadania', 'error');
    }
  }

  /**
   * Zaktualizuj UI karty zadania
   */
  updateTaskUI(cardElement, isCompleted) {
    if (!cardElement) return;

    const button = cardElement.querySelector('.task-action-btn');
    
    if (isCompleted) {
      cardElement.classList.add('completed');
      button.textContent = 'Cofnij';
      button.className = 'btn btn-secondary task-action-btn';
    } else {
      cardElement.classList.remove('completed');
      button.textContent = 'Wykonaj';
      button.className = 'btn btn-primary task-action-btn';
    }
  }

  /**
   * Odśwież statystyki użytkownika w nagłówku
   */
  async refreshUserStats() {
    if (!this.currentUser) return;

    try {
      const { data: profile, error } = await sb
        .from('profiles')
        .select('xp, level, visited_places')
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      // Aktualizuj nagłówek (jeśli funkcja istnieje)
      if (typeof window.updateHeaderMetrics === 'function') {
        window.updateHeaderMetrics(
          profile.xp || 0, 
          profile.level || 1, 
          (profile.visited_places || []).length
        );
      }

      console.log('✅ User stats refreshed:', profile);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }

  /**
   * Pobierz tytuł zadania z tłumaczeń
   */
  getTaskTitle(task) {
    const key = `tasks.items.${task.id}.title`;
    
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[key] || this.formatTaskId(task.id);
    }
    
    return this.formatTaskId(task.id);
  }

  /**
   * Pobierz opis zadania z tłumaczeń
   */
  getTaskDescription(task) {
    const key = `tasks.items.${task.id}.description`;
    
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[key] || 'Brak opisu';
    }
    
    return 'Brak opisu';
  }

  /**
   * Formatuj ID zadania jako tytuł (fallback)
   */
  formatTaskId(taskId) {
    return taskId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Pokaż powiadomienie toast
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `task-toast task-toast-${type}`;
    toast.textContent = message;
    
    // Style
    const bgColors = {
      success: '#4caf50',
      error: '#f44336',
      info: '#2196f3',
      warning: '#ff9800'
    };
    
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${bgColors[type] || bgColors.info};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-size: 0.95rem;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    // Auto-usuń po 4 sekundach
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Eksportuj instancję i funkcję inicjalizacji
const tasksManager = new TasksManager();

export async function initTasks(tasksData = null) {
  await tasksManager.init(tasksData);
}

export default tasksManager;
