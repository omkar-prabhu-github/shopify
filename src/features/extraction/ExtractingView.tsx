import React from 'react';
import {
  Card, BlockStack, Text, Spinner, Box,
} from '@shopify/polaris';

export const ExtractingView: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--p-color-bg-surface-secondary)',
      padding: 20,
    }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div className="axiom-fade-in">
          <Card>
            <BlockStack gap="400" align="center" inlineAlign="center">
              <Box padding="200">
                <Spinner size="large" />
              </Box>
              <Text as="h2" variant="headingLg" alignment="center">
                Connecting to your store
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                Extracting products, collections, policies, and blog content…
              </Text>

              {/* Animated progress bar */}
              <Box paddingBlockStart="200" paddingBlockEnd="100" width="100%">
                <div style={{
                  height: 4,
                  background: 'var(--p-color-bg-fill-secondary)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div className="axiom-progress-animate" style={{
                    height: '100%',
                    background: 'var(--p-color-bg-fill-brand)',
                    borderRadius: 2,
                  }} />
                </div>
              </Box>

              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                This usually takes 10–15 seconds
              </Text>
            </BlockStack>
          </Card>
        </div>
      </div>
    </div>
  );
};
