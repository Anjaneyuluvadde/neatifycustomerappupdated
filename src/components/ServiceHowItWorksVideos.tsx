import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';

const CARD_WIDTH = 140;
const CARD_HEIGHT = 215; // Matches the calculated height of SimilarServices cards

interface ServiceHowItWorksVideosProps {
  serviceId: string;
}

interface VideoRecord {
  id: string;
  service_id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function ServiceHowItWorksVideos({ serviceId }: ServiceHowItWorksVideosProps) {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    fetchVideos();
  }, [serviceId]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("service_how_it_works_videos")
        .select("*")
        .eq("service_id", serviceId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("[ServiceHowItWorksVideos] Error fetching videos:", error);
        return;
      }
      setVideos(data || []);
    } catch (error) {
      console.error("[ServiceHowItWorksVideos] Exception fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const itemWidth = CARD_WIDTH + 12; // width + gap
    const index = Math.round(offsetX / itemWidth);
    if (index >= 0 && index < videos.length) {
      setActiveIndex(index);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.saffron} />
      </View>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        snapToInterval={CARD_WIDTH + 12} // width + gap
        decelerationRate="fast"
        contentContainerStyle={styles.flatListContent}
        renderItem={({ item, index }) => {
          const isActive = index === activeIndex && isScreenFocused;

          return (
            <View style={styles.cardWrapper}>
              <HowItWorksVideoCard
                video={item}
                index={index}
                isActive={isActive}
                progressText={videos.length > 1 ? `${index + 1} / ${videos.length}` : ''}
                onActivate={() => setActiveIndex(index)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

interface HowItWorksVideoCardProps {
  video: VideoRecord;
  index: number;
  isActive: boolean;
  progressText: string;
  onActivate: () => void;
}

function HowItWorksVideoCard({
  video,
  index,
  isActive,
  progressText,
  onActivate
}: HowItWorksVideoCardProps) {

  const [isPlaying, setIsPlaying] = useState(isActive);
  const [isMuted, setIsMuted] = useState(true);

  const player = useVideoPlayer(video.video_url, p => {
    p.loop = true;
    p.muted = true;
  });

  // Sync mute state independently for this video
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  // Sync active state from parent
  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
      player.play();
    } else {
      setIsPlaying(false);
      player.pause();
    }
  }, [isActive, player]);

  const handleTogglePlayPause = () => {
    if (!isActive) {
      // Tap on an inactive video: make it the active one
      onActivate();
    } else {
      // Toggle play/pause for the already active video
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <View style={styles.videoCard}>
      <Pressable style={styles.videoPressable} onPress={handleTogglePlayPause}>
        <VideoView
          player={player}
          style={styles.videoView}
          contentFit="cover"
          nativeControls={false}
        />

        {/* Play/Pause Overlay Component */}
        {!isPlaying && isActive && (
          <View style={styles.playPauseOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={20} color="white" style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}

        {/* Gradient Overlay at Bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bottomGradient}
        >
          <View style={styles.bottomContent}>
            {/* Title */}
            {video.title ? (
              <Text style={styles.titleText} numberOfLines={2}>{video.title}</Text>
            ) : null}

            {/* Controls (Mute & Progress) */}
            <View style={styles.controlsRow}>
              {progressText ? (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>{progressText}</Text>
                </View>
              ) : <View />}

              <Pressable onPress={handleToggleMute} style={styles.muteButton}>
                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={14} color="white" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    marginBottom: 24,
  },
  flatListContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardWrapper: {
    // Ensures the card participates nicely in the gap layout
  },
  videoCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  videoPressable: {
    flex: 1,
  },
  videoView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 30,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  bottomContent: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  titleText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  muteButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 6,
    borderRadius: 16,
  },
});
