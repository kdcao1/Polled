import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, GoogleAuthProvider, linkWithCredential } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import * as Google from 'expo-auth-session/providers/google';

export default function LinkAccountScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // --- REUSABLE TOAST HELPER ---
  const showToast = (title: string, description: string, type: 'success' | 'error') => {
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast 
          nativeID={id} 
          className={`mt-12 px-4 py-3 rounded-xl border ${type === 'success' ? 'bg-green-600/20 border-green-500/50' : 'bg-red-600/20 border-red-500/50'}`}
        >
          <VStack>
            <ToastTitle className={`font-bold text-sm ${type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {title}
            </ToastTitle>
            <ToastDescription className="text-zinc-300 text-xs mt-0.5">
              {description}
            </ToastDescription>
          </VStack>
        </Toast>
      ),
    });
  };

  // -------------------------------------------------------------------------
  // GOOGLE AUTH SETUP
  // -------------------------------------------------------------------------
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '1059076773398-0oicat1eqqohtsrhrajpbsm67spk2u9s.apps.googleusercontent.com',
    iosClientId: '79016124142-vstsqihv3ahndlhirremvhdtl8mt99j0.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLink(id_token);
    }
  }, [response]);

  const handleGoogleLink = async (idToken: string) => {
    if (!user) return;
    setIsLinking(true);

    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await linkWithCredential(user, credential);
      
      showToast('Account Secured!', 'Your account is now linked to Google.', 'success');
      router.back();

    } catch (error: any) {
      console.error('Error linking Google account:', error);
      if (error.code === 'auth/credential-already-in-use') {
        showToast('Already Linked', 'This Google account is already attached to another Polled user.', 'error');
      } else {
        showToast('Error', 'Could not link Google account. Try again.', 'error');
      }
    } finally {
      setIsLinking(false);
    }
  };

  // -------------------------------------------------------------------------
  // EMAIL AUTH SETUP
  // -------------------------------------------------------------------------
  const handleLinkEmail = async () => {
    if (!email.trim() || !password.trim() || !user) return;
    setIsLinking(true);

    try {
      const credential = EmailAuthProvider.credential(email.trim(), password);
      await linkWithCredential(user, credential);
      
      showToast('Account Secured!', 'Your email and password have been saved.', 'success');
      router.back();

    } catch (error: any) {
      console.error('Error linking email:', error);
      if (error.code === 'auth/email-already-in-use') {
        showToast('Email Taken', 'This email is already registered.', 'error');
      } else {
        showToast('Error', 'Could not secure account. Please try again.', 'error');
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <Box className="flex-1 bg-zinc-900 px-6 justify-center items-center">
        <VStack className="gap-6 w-full max-w-sm">
          
          <VStack className="gap-2 text-center items-center mb-2">
            <Heading size="2xl" className="text-zinc-50">Secure Account</Heading>
            <Text className="text-zinc-400 text-center">
              Link an account to save your events and log in from other devices.
            </Text>
          </VStack>

          <VStack className="gap-6">
            
            {/* GOOGLE BUTTON */}
            <Button 
              size="xl" 
              className="bg-white border-0" 
              onPress={() => promptAsync()}
              isDisabled={!request || isLinking}
            >
              {isLinking ? (
                <ButtonSpinner color="#18181b" /> 
              ) : (
                <HStack className="items-center gap-2">
                  <Text className="text-black font-bold text-lg">G</Text>
                  <ButtonText className="font-bold text-black">Continue with Google</ButtonText>
                </HStack>
              )}
            </Button>

            {/* DIVIDER */}
            <HStack className="items-center gap-4 my-2">
              <View className="flex-1 h-px bg-zinc-700" />
              <Text className="text-zinc-500 text-sm font-medium uppercase">Or use email</Text>
              <View className="flex-1 h-px bg-zinc-700" />
            </HStack>

            {/* EMAIL FORM */}
            <VStack className="gap-4">
              <Input variant="outline" size="xl" className="border-zinc-700 bg-zinc-800">
                <InputField
                  placeholder="name@example.com"
                  placeholderTextColor="#a1a1aa"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="text-zinc-50"
                />
              </Input>

              <Input variant="outline" size="xl" className="border-zinc-700 bg-zinc-800">
                <InputField
                  placeholder="Password (min 6 chars)"
                  placeholderTextColor="#a1a1aa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  className="text-zinc-50"
                />
              </Input>

              <Button 
                size="xl" 
                variant="outline"
                className="border-zinc-700 bg-zinc-800 mt-2" 
                onPress={handleLinkEmail}
                isDisabled={isLinking || !email.trim() || !password.trim()}
              >
                <ButtonText className="font-bold text-zinc-50">Save Email & Password</ButtonText>
              </Button>
            </VStack>

            <Button 
              size="xl" 
              variant="link" 
              onPress={() => router.back()}
              isDisabled={isLinking}
            >
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>

          </VStack>
        </VStack>
      </Box>
    </KeyboardAvoidingView>
  );
}