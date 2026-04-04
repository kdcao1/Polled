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
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { trackEvent } from '@/utils/analytics';
import { googleAuthConfig, hasGoogleAuthConfig } from '@/config/env';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const showToast = (title: string, description: string, type: 'success' | 'error') => {
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast 
          nativeID={id} 
          className={`mt-24 px-4 py-3 rounded-xl border ${type === 'success' ? 'bg-green-600/20 border-green-500/50' : 'bg-red-600/20 border-red-500/50'}`}
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
  // GOOGLE LOGIN SETUP
  // -------------------------------------------------------------------------
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleAuthConfig);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    setIsLoggingIn(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      trackEvent('login_success', { method: 'google' });
      
      router.replace('/dashboard');

    } catch (error: any) {
      console.error('Error logging in with Google:', error);
      trackEvent('login_failed', { method: 'google', error_code: error?.code || 'unknown' });
      showToast('Login Failed', 'Could not log in with Google. Please try again.', 'error');
      setIsLoggingIn(false);
    }
  };

  // -------------------------------------------------------------------------
  // EMAIL LOGIN SETUP
  // -------------------------------------------------------------------------
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setIsLoggingIn(true);
    trackEvent('login_attempt', { method: 'email' });

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      trackEvent('login_success', { method: 'email' });
      router.replace('/dashboard');
      
    } catch (error: any) {
      console.error('Error logging in with email:', error);
      trackEvent('login_failed', { method: 'email', error_code: error?.code || 'unknown' });
      
      // Firebase unified wrong-password and user-not-found into invalid-credential for security
      if (error.code === 'auth/invalid-credential') {
        showToast('Invalid Login', 'The email or password you entered is incorrect.', 'error');
      } else if (error.code === 'auth/too-many-requests') {
        showToast('Account Locked', 'Too many failed attempts. Try again later.', 'error');
      } else {
        showToast('Error', 'Could not log in. Please check your connection.', 'error');
      }
      setIsLoggingIn(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <Box className="flex-1 bg-zinc-900 px-6 pt-4">
        <VStack className="gap-8 w-full max-w-sm self-center mt-8">
          
          {/* Header & Back Button */}
          <VStack className="gap-2">
            <Button 
              variant="link" 
              onPress={() => router.back()} 
              className="self-start p-0 -ml-2"
              isDisabled={isLoggingIn}
            >
              <ButtonText className="text-blue-500">← Back</ButtonText>
            </Button>
            <Heading size="3xl" className="text-zinc-50">Welcome back</Heading>
            <Text className="text-zinc-400">Log in to view your events and polls.</Text>
          </VStack>

          <VStack className="gap-6 mt-4">
            
            {/* GOOGLE BUTTON */}
            <Button 
              size="xl" 
              className="bg-white border-0" 
              onPress={() => {
                trackEvent('login_attempt', { method: 'google' });
                promptAsync();
              }}
              isDisabled={!request || isLoggingIn || !hasGoogleAuthConfig}
            >
              {isLoggingIn ? (
                <ButtonSpinner color="#18181b" /> 
              ) : (
                <HStack className="items-center gap-2">
                  <Text className="text-black font-bold text-lg">G</Text>
                  <ButtonText className="font-bold text-black">Log in with Google</ButtonText>
                </HStack>
              )}
            </Button>

            {/* DIVIDER */}
            <HStack className="items-center gap-4 my-2">
              <View className="flex-1 h-px bg-zinc-700" />
              <Text className="text-zinc-500 text-sm font-medium uppercase">Or log in with email</Text>
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
                  onSubmitEditing={handleEmailLogin}
                />
              </Input>

              <Input variant="outline" size="xl" className="border-zinc-700 bg-zinc-800">
                <InputField
                  placeholder="Password"
                  placeholderTextColor="#a1a1aa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  className="text-zinc-50"
                  onSubmitEditing={handleEmailLogin}
                />
              </Input>

              <Button 
                size="xl" 
                action="primary"
                className="bg-blue-600 border-0 mt-2" 
                onPress={handleEmailLogin}
                isDisabled={isLoggingIn || !email.trim() || !password.trim()}
              >
                {isLoggingIn ? <ButtonSpinner color="white" /> : <ButtonText className="font-bold text-white">Log In</ButtonText>}
              </Button>
            </VStack>

          </VStack>
        </VStack>
      </Box>
    </KeyboardAvoidingView>
  );
}
