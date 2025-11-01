import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export const UserHeader = () => {
  const { user, notifications, unreadCount, logout, markNotificationAsRead, clearAllNotifications } = useAuth();
  const insets = useSafeAreaInsets();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    Alert.alert(
      'Wylogowanie',
      'Czy na pewno chcesz się wylogować?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyloguj',
          style: 'destructive',
          onPress: () => {
            logout();
            setShowMenu(false);
          },
        },
      ]
    );
  };

  const handleNotificationPress = (id: string) => {
    markNotificationAsRead(id);
  };

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {/* Avatar i powitanie */}
        <TouchableOpacity 
          style={styles.userSection}
          onPress={() => setShowMenu(true)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: user.avatarUrl }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>
              Grasz jako {user.name}
            </Text>
            {user.isGuest && (
              <Text style={styles.guestBadge}>Tryb gościa</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Powiadomienia */}
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => setShowNotifications(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.notificationIcon}>🔔</Text>
          <Text style={styles.notificationLabel}>Powiadomienia</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal powiadomień */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Powiadomienia</Text>
              <View style={styles.modalHeaderActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      clearAllNotifications();
                    }}
                    style={styles.markAllButton}
                  >
                    <Text style={styles.markAllText}>Oznacz wszystkie</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowNotifications(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.notificationsList}>
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Brak powiadomień</Text>
                </View>
              ) : (
                notifications.map(notification => (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      !notification.read && styles.notificationUnread
                    ]}
                    onPress={() => handleNotificationPress(notification.id)}
                  >
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      <Text style={styles.notificationTime}>
                        {notification.timestamp.toLocaleTimeString('pl-PL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                    {!notification.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal menu użytkownika */}
      <Modal
        visible={showMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={[styles.menuContent, { marginTop: insets.top + 60 }]}>
            <View style={styles.menuHeader}>
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.menuAvatar}
              />
              <View style={styles.menuUserInfo}>
                <Text style={styles.menuUserName}>{user.name}</Text>
                <Text style={styles.menuUserEmail}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                // Tutaj można dodać nawigację do statystyk
              }}
            >
              <Text style={styles.menuItemIcon}>📊</Text>
              <Text style={styles.menuItemText}>Statystyki i ustawienia</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleLogout}
            >
              <Text style={styles.menuItemIcon}>🚪</Text>
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Wyloguj</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.6)',
    backgroundColor: '#1f2937',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 2,
  },
  guestBadge: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  notificationIcon: {
    fontSize: 18,
  },
  notificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e0f2fe',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 16,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0369a1',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  notificationsList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '500',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notificationUnread: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: 8,
    marginLeft: 8,
  },
  menuContent: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
  },
  menuAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  menuUserInfo: {
    flex: 1,
  },
  menuUserName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  menuUserEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginVertical: 4,
  },
  menuItemIcon: {
    fontSize: 20,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  menuItemDanger: {
    backgroundColor: '#fef2f2',
  },
  menuItemTextDanger: {
    color: '#dc2626',
  },
});
