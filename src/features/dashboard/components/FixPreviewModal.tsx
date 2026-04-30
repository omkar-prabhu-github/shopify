import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal, Text, BlockStack, Box, InlineStack, Badge, Banner, Divider, TextField,
} from '@shopify/polaris';
import { applyFix } from '../../../api/fixClient';
import type { FixPayload } from '../../../api/fixClient';

interface FixPreviewModalProps {
  open: boolean;
  fix: FixPayload | null;
  shop: string;
  onClose: () => void;
  onFixed?: (fix: FixPayload) => void;
  refreshData?: () => Promise<void>;
}

export const FixPreviewModal: React.FC<FixPreviewModalProps> = ({ open, fix, shop, onClose, onFixed, refreshData }) => {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editedValue, setEditedValue] = useState('');

  // Reset edited value whenever a new fix is opened
  useEffect(() => {
    if (fix) {
      setEditedValue(fix.newValue || '');
      setResult(null);
    }
  }, [fix]);

  const handleApply = useCallback(async () => {
    if (!fix) return;
    setApplying(true);
    setResult(null);
    try {
      const token = sessionStorage.getItem('shopify_token') || '';
      // Use edited value instead of the original proposed value
      const fixToApply = { ...fix, newValue: editedValue };
      await applyFix(shop, token, fixToApply);
      setResult({ success: true, message: 'Fix applied successfully! The change is now live on your store.' });
      onFixed?.(fix);
      // Silently re-extract store data so all pages reflect the change
      refreshData?.();
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to apply fix' });
    } finally {
      setApplying(false);
    }
  }, [fix, shop, onFixed, editedValue]);

  const handleClose = useCallback(() => {
    setResult(null);
    onClose();
  }, [onClose]);

  if (!fix) return null;

  const typeLabel = fix.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={fix.label || 'Apply Fix'}
      primaryAction={{
        content: result?.success ? 'Done' : applying ? 'Applying…' : 'Apply Fix',
        onAction: result?.success ? handleClose : handleApply,
        loading: applying,
        disabled: applying,
        destructive: false,
      }}
      secondaryActions={result?.success ? [] : [{ content: 'Cancel', onAction: handleClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="info">{typeLabel}</Badge>
            {fix.resourceTitle && (
              <Text as="span" variant="bodySm" tone="subdued">{fix.resourceTitle}</Text>
            )}
          </InlineStack>

          <Divider />

          {/* Current (read-only) */}
          <Box background="bg-surface-critical" padding="300" borderRadius="200">
            <BlockStack gap="200">
              <Text as="span" variant="headingSm" tone="critical">Current</Text>
              <div style={{
                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 160, overflow: 'auto',
                color: 'var(--p-color-text-secondary)',
              }}>
                {fix.oldValue || '(empty)'}
              </div>
            </BlockStack>
          </Box>

          {/* Proposed (editable) */}
          <Box background="bg-surface-success" padding="300" borderRadius="200">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="headingSm" tone="success">Proposed</Text>
                <Text as="span" variant="bodySm" tone="subdued">Editable — modify before applying</Text>
              </InlineStack>
              <TextField
                label="Proposed value"
                labelHidden
                value={editedValue}
                onChange={setEditedValue}
                multiline={4}
                autoComplete="off"
                disabled={applying || !!result?.success}
              />
            </BlockStack>
          </Box>

          {result && (
            <Banner tone={result.success ? 'success' : 'critical'}>
              <p>{result.message}</p>
            </Banner>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};
