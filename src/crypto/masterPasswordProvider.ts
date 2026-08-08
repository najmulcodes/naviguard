import Constants from 'expo-constants';

export function getMasterPassword(): string {
  const value = Constants.expoConfig?.extra?.masterPassword as string | undefined;
  if (!value) {
    throw new Error(
      'NAVIGUARD_MASTER_PASSWORD is not set. See .env.example — copy to .env for local ' +
        'builds, or set an EAS Secret named NAVIGUARD_MASTER_PASSWORD for cloud builds.'
    );
  }
  return value;
}
