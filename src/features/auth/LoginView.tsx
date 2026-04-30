import React, { useState } from 'react';
import {
  Page, Card, FormLayout, TextField, Button, Text, BlockStack,
  InlineStack, Banner, Box, Divider, Icon,
} from '@shopify/polaris';
import { LockIcon, KeyIcon } from '@shopify/polaris-icons';

interface LoginViewProps {
  onExtract: (domain: string, token: string) => void;
  error?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ onExtract, error }) => {
  const [mode, setMode] = useState<'oauth' | 'manual'>('oauth');
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [oauthDomain, setOauthDomain] = useState('');

  const handleManualSubmit = () => {
    if (domain && token) onExtract(domain, token);
  };

  const handleOAuthInstall = () => {
    if (!oauthDomain) return;
    let shop = oauthDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!shop.includes('.')) shop = `${shop}.myshopify.com`;
    window.location.href = `http://localhost:3000/api/auth?shop=${shop}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--p-color-bg-surface-secondary)',
      padding: 16,
    }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        <Card>
          <BlockStack gap="500">
            {/* Header */}
            <BlockStack gap="200" inlineAlign="center">
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'var(--p-color-bg-fill-info)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon source={LockIcon} tone="textInverse" />
              </div>
              <Text as="h1" variant="headingLg" alignment="center">Axiom</Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Connect your Shopify store to begin.
              </Text>
            </BlockStack>

            {error && <Banner tone="critical"><p>{error}</p></Banner>}

            {/* Tab Switcher */}
            <InlineStack gap="200" align="center">
              <Button
                pressed={mode === 'oauth'}
                onClick={() => setMode('oauth')}
                variant={mode === 'oauth' ? 'primary' : 'secondary'}
                size="slim"
                icon={LockIcon}
              >
                OAuth Install
              </Button>
              <Button
                pressed={mode === 'manual'}
                onClick={() => setMode('manual')}
                variant={mode === 'manual' ? 'primary' : 'secondary'}
                size="slim"
                icon={KeyIcon}
              >
                Manual Token
              </Button>
            </InlineStack>

            <Divider />

            {/* OAuth Mode */}
            {mode === 'oauth' && (
              <BlockStack gap="400">
                <TextField
                  label="Store Name"
                  value={oauthDomain}
                  onChange={setOauthDomain}
                  placeholder="e.g. mystore"
                  suffix=".myshopify.com"
                  autoComplete="off"
                />
                <Text as="p" variant="bodySm" tone="subdued">
                  You'll be redirected to Shopify to authorize access.
                </Text>
                <Button onClick={handleOAuthInstall} variant="primary" fullWidth size="large">
                  Install with Shopify
                </Button>
              </BlockStack>
            )}

            {/* Manual Mode */}
            {mode === 'manual' && (
              <BlockStack gap="400">
                <FormLayout>
                  <TextField
                    label="Store Domain"
                    value={domain}
                    onChange={setDomain}
                    placeholder="e.g. mystore.myshopify.com"
                    autoComplete="off"
                  />
                  <TextField
                    label="Admin API Access Token"
                    value={token}
                    onChange={setToken}
                    placeholder="shpat_..."
                    type="password"
                    autoComplete="off"
                  />
                </FormLayout>
                <Button onClick={handleManualSubmit} variant="primary" fullWidth size="large">
                  Extract Store Data
                </Button>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </div>
    </div>
  );
};
