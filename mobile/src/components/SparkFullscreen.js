// A Spark full screen, YouTube style: the whole video on black with all the controls. The rotate button turns it
// sideways so a landscape video fills the phone held on its side (works without changing the app's orientation).
import { useState } from 'react';
import { Modal, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SparkVideo from './SparkVideo';
import { toggleSparksMuted, useSparksMuted } from '../lib/sparkSound';

export default function SparkFullscreen({ visible, onClose, spark, onFirstPlay }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rot, setRot] = useState(false);
  const muted = useSparksMuted();
  if (!visible || !spark) return null;
  // rotated: the player is laid out landscape (height × width) and turned 90°
  const w = rot ? height : width; const h = rot ? width : height;
  const Btn = ({ icon, label, onPress, mci }) => (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', marginLeft: 8 }}>
      {mci ? <MaterialCommunityIcons name={icon} size={22} color="#fff" /> : <Ionicons name={icon} size={22} color="#fff" />}
    </Pressable>
  );
  const close = () => { setRot(false); onClose(); };
  return (
    <Modal visible animationType="fade" onRequestClose={close} supportedOrientations={['portrait', 'landscape']} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: w, height: h, transform: rot ? [{ rotate: '90deg' }] : [] }}>
          <SparkVideo uri={spark.videoUrl} musicUri={spark.music?.url} edit={spark.details?.edit} height={h} fill autoPlay active controls fullscreen
            muted={muted} onToggleMute={toggleSparksMuted} onFullscreen={close} onFirstPlay={onFirstPlay} />
          <View pointerEvents="box-none" style={{ position: 'absolute', top: rot ? 12 : insets.top + 8, right: rot ? insets.top + 12 : 12, flexDirection: 'row' }}>
            <Btn icon="phone-rotate-landscape" label={rot ? 'Turn back upright' : 'Turn sideways for landscape'} onPress={() => setRot((r) => !r)} mci />
            <Btn icon="close" label="Close full screen" onPress={close} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
