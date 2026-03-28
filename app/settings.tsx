import React, { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Modal, View, TouchableOpacity } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { useRouter } from 'expo-router';
import { updateProfile, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { Pencil } from 'lucide-react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const toast = useToast();
  
  const [displayName, setDisplayName] = useState('');
  const [savedName, setSavedName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // State to control the Edit Name popup modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Determine Login Type
  const isAnon = user?.isAnonymous;
  const providers = user?.providerData.map(p => p.providerId) || [];
  let loginType = 'Loginless User';
  if (!isAnon) {
    if (providers.includes('google.com')) loginType = 'Google Account';
    else if (providers.includes('password')) loginType = 'Email Account';
  }

  useEffect(() => {
    if (isEditModalOpen) {
      setDisplayName(savedName);
    }
  }, [isEditModalOpen, savedName]);

  const handleSaveName = async () => {
    if (!displayName.trim() || !user) return;
    
    setIsSaving(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { displayName: displayName.trim() });
      
      setSavedName(displayName.trim());
      setIsEditModalOpen(false);
      
      // --- NEW SUCCESS TOAST ---
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} className="bg-green-600/20 border border-green-500/50 mt-12 px-4 py-3 rounded-xl">
            <VStack>
              <ToastTitle className="text-green-400 font-bold text-sm">Success</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Your profile has been updated.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // --- NEW ERROR TOAST ---
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} className="bg-red-600/20 border border-red-500/50 mt-12 px-4 py-3 rounded-xl">
            <VStack>
              <ToastTitle className="text-red-400 font-bold text-sm">Error</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Could not update your name. Try again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Secure Logout
  // -------------------------------------------------------------------------
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
      setIsLoggingOut(false);
      Alert.alert('Error', 'Could not sign out. Try again.');
    }
  };

  return (
    <Box className="flex-1 bg-zinc-900 px-6 pt-4">
      <VStack className="gap-8 w-full max-w-sm self-center">
        
        {/* Header & Back Button */}
        <VStack className="gap-2">
          <Button 
            variant="link" 
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/dashboard');
            }} 
            className="self-start p-0 -ml-2"
          >
            <ButtonText className="text-blue-500">← Back</ButtonText>
          </Button>
          <Heading size="2xl" className="text-zinc-50">Settings</Heading>
        </VStack>

        {/* --- UPDATED: Read-Only Profile Section --- */}
        <VStack className="gap-4">
          <Text className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Profile</Text>
          
          <HStack className="justify-between items-center bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
            <VStack>
              <Text className="text-zinc-400 text-sm">Display Name</Text>
              {/* NOW USING SAVED NAME STATE */}
              <Text className="text-zinc-50 font-medium text-lg mt-0.5">
                {savedName || 'Anonymous User'}
              </Text>
            </VStack>
            
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setIsEditModalOpen(true)}
              className="w-10 h-10 bg-zinc-700/50 rounded-full items-center justify-center border border-zinc-600/50"
            >
              <Pencil size={18} color="#d4d4d8" />
            </TouchableOpacity>
          </HStack>
        </VStack>

        {/* Account Section */}
        <VStack className="gap-4 pb-12 mt-4">
          <Text className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Account Status</Text>
          
          <HStack className="justify-between items-center bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
            <VStack>
              <Text className="text-zinc-50 font-medium">Account Type</Text>
              <Text className={`text-sm font-semibold mt-0.5 ${isAnon ? 'text-amber-400' : 'text-green-400'}`}>
                {loginType}
              </Text>
            </VStack>
          </HStack>

          {isAnon && (
            <Button 
              size="xl" 
              variant="outline" 
              className="border-zinc-700 bg-zinc-800 mt-2" 
              onPress={() => router.push('/link-account')}
            >
              <ButtonText className="font-bold text-zinc-50">Link Email or Google</ButtonText>
            </Button>
          )}

          <Button 
            size="xl" 
            variant="outline" 
            className="border-red-500/30 mt-4" 
            onPress={handleLogout}
            isDisabled={isLoggingOut}
          >
            {isLoggingOut ? <ButtonSpinner color="#ef4444" /> : <ButtonText className="font-bold text-red-500">Log Out</ButtonText>}
          </Button>
        </VStack>

      </VStack>

      {/* --- NEW: Edit Name Modal Overlay --- */}
      <Modal
        visible={isEditModalOpen}
        transparent={true}
        animationType="fade"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/70 justify-center items-center px-6">
            <View className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl gap-6">
              
              <VStack className="gap-2">
                <Heading size="xl" className="text-zinc-50">Edit Name</Heading>
                <Text className="text-zinc-400 text-sm">This is how you will appear in events and polls.</Text>
              </VStack>
              
              <Input variant="outline" size="xl" className="border-zinc-700 bg-zinc-800">
                <InputField
                  placeholder="e.g., Kevin"
                  placeholderTextColor="#a1a1aa"
                  value={displayName}
                  onChangeText={setDisplayName}
                  className="text-zinc-50"
                  autoFocus={true} // Pops the keyboard up immediately!
                />
              </Input>

              <HStack className="justify-end gap-3 mt-2">
                <Button 
                  size="md" 
                  variant="link" 
                  onPress={() => setIsEditModalOpen(false)}
                  isDisabled={isSaving}
                >
                  <ButtonText className="text-zinc-400">Cancel</ButtonText>
                </Button>
                
                <Button 
                  size="md" 
                  action="primary" 
                  className="bg-blue-600 border-0 px-6" 
                  onPress={handleSaveName}
                  isDisabled={isSaving || !displayName.trim() || displayName.trim() === user?.displayName}
                >
                  {isSaving ? <ButtonSpinner color="white" /> : <ButtonText className="font-bold text-white">Save</ButtonText>}
                </Button>
              </HStack>

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </Box>
  );
}