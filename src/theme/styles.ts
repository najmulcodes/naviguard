import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navyBase,
    padding: 24,
    justifyContent: 'center'
  },
  scrollScreen: {
    flexGrow: 1,
    backgroundColor: colors.navyBase,
    padding: 24
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    color: colors.goldPrimary,
    textAlign: 'center',
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20
  },
  input: {
    backgroundColor: colors.navyElevated,
    color: colors.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2E42',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginTop: 12
  },
  primaryButton: {
    backgroundColor: colors.goldPrimary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20
  },
  primaryButtonText: {
    color: colors.navyDeep,
    fontWeight: '700',
    fontSize: 16
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.goldPrimary
  },
  secondaryButtonText: {
    color: colors.goldPrimary,
    fontWeight: '600',
    fontSize: 16
  },
  textButton: {
    alignItems: 'center',
    marginTop: 16
  },
  textButtonText: {
    color: colors.textSecondary,
    fontSize: 14
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  }
});
