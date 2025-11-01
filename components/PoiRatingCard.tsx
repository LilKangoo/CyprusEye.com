import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getRatingStats, ratePlace, getUserRating, type RatingStats } from '../lib/supabase';
import type { GeofencePOI } from '../lib/geofencing';

interface PoiRatingCardProps {
  poi: GeofencePOI;
  onClose?: () => void;
}

export default function PoiRatingCard({ poi, onClose }: PoiRatingCardProps) {
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [poi.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, userRatingData] = await Promise.all([
        getRatingStats(poi.id),
        getUserRating(poi.id),
      ]);
      setStats(statsData);
      setUserRating(userRatingData);
    } catch (error) {
      console.error('Error loading rating data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (rating: number) => {
    const success = await ratePlace(poi.id, rating);
    if (success) {
      setUserRating(rating);
      // Reload stats to get updated average
      const newStats = await getRatingStats(poi.id);
      setStats(newStats);
    } else {
      Alert.alert('Błąd', 'Musisz być zalogowany, aby ocenić miejsce');
    }
  };

  const openCommunity = () => {
    const url = `https://www.cypruseye.com/community.html?location=${encodeURIComponent(poi.id)}`;
    Linking.openURL(url).catch((err: Error) => {
      console.error('Failed to open URL:', err);
      Alert.alert('Błąd', 'Nie udało się otworzyć strony społeczności');
    });
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
      const isFull = i <= fullStars;
      const isHalf = i === fullStars + 1 && hasHalfStar;
      const isHovered = hoveredStar !== null && i <= hoveredStar;

      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => interactive && handleRate(i)}
          disabled={!interactive}
          style={styles.starButton}
        >
          <Text
            style={[
              styles.star,
              (isFull || isHalf || isHovered) && styles.starFilled,
              interactive && styles.starInteractive,
            ]}
          >
            {isFull || isHovered ? '★' : isHalf ? '⯨' : '☆'}
          </Text>
        </TouchableOpacity>
      );
    }

    return <View style={styles.starsContainer}>{stars}</View>;
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#f97316" />
      </View>
    );
  }

  const averageRating = stats?.average_rating || 0;
  const totalRatings = stats?.total_ratings || 0;

  return (
    <View style={styles.card}>
      {/* Close button */}
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* POI Name */}
      <Text style={styles.poiName} numberOfLines={2}>
        {poi.name}
      </Text>

      {/* Average Rating Display */}
      <View style={styles.ratingSection}>
        <View style={styles.averageRatingContainer}>
          {renderStars(averageRating, false)}
          <View style={styles.ratingInfo}>
            <Text style={styles.averageRatingValue}>
              {averageRating > 0 ? averageRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.ratingCount}>
              {totalRatings > 0
                ? `${totalRatings} ${totalRatings === 1 ? 'ocena' : 'ocen'}`
                : 'Brak ocen'}
            </Text>
          </View>
        </View>
      </View>

      {/* User Rating Section */}
      <View style={styles.userRatingSection}>
        <Text style={styles.userRatingLabel}>Oceń to miejsce:</Text>
        {renderStars(userRating || 0, true)}
        {userRating && (
          <Text style={styles.userRatingText}>Twoja ocena: {userRating} ★</Text>
        )}
      </View>

      {/* Community Button */}
      <TouchableOpacity style={styles.communityButton} onPress={openCommunity}>
        <Text style={styles.communityButtonIcon}>📸</Text>
        <View style={styles.communityButtonContent}>
          <Text style={styles.communityButtonTitle}>Zobacz społeczność</Text>
          <Text style={styles.communityButtonSubtitle}>Zdjęcia, komentarze i więcej</Text>
        </View>
        <Text style={styles.communityButtonArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  poiName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    paddingRight: 32,
  },
  ratingSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  averageRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 2,
  },
  star: {
    fontSize: 24,
    color: '#d1d5db',
  },
  starFilled: {
    color: '#f59e0b',
  },
  starInteractive: {
    color: '#fbbf24',
  },
  ratingInfo: {
    flexDirection: 'column',
  },
  averageRatingValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  ratingCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  userRatingSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  userRatingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  userRatingText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 8,
    fontWeight: '600',
  },
  communityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  communityButtonIcon: {
    fontSize: 24,
  },
  communityButtonContent: {
    flex: 1,
  },
  communityButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  communityButtonSubtitle: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 2,
  },
  communityButtonArrow: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '600',
  },
});
