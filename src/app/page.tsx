import OrchardApp from '@/components/OrchardApp';

export default function Home() {
  return <OrchardApp captureEnabled={process.env.ELEVENLABS_CAPTURE_ENABLED === 'true'}/>;
}
