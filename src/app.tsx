import { PropsWithChildren } from 'react';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import PrivacyPopup from '@/components/privacy-popup';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
      <PrivacyPopup />
    </LucideTaroProvider>
  );
};

export default App;
