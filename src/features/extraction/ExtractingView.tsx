import React from 'react';
import {
  Frame, Page, Card, BlockStack, Text, Spinner, Box, ProgressBar,
} from '@shopify/polaris';

export const ExtractingView: React.FC = () => {
  return (
    <Frame>
      <Page>
        <div style={{ maxWidth: 480, margin: '80px auto' }}>
          <Card>
            <BlockStack gap="400" align="center" inlineAlign="center">
              <Box padding="200">
                <Spinner size="large" />
              </Box>
              <Text as="h2" variant="headingLg" alignment="center">
                Connecting to your store
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                Securely extracting your product catalog, collections, policies, and blog content…
              </Text>
              <Box paddingBlockStart="200" paddingBlockEnd="100" width="100%">
                <ProgressBar progress={75} size="small" tone="primary" />
              </Box>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                This usually takes 10-15 seconds
              </Text>
            </BlockStack>
          </Card>
        </div>
      </Page>
    </Frame>
  );
};
