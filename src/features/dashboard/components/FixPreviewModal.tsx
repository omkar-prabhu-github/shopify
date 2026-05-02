import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal, Text, BlockStack, Box, InlineStack, Badge, Banner, Divider, TextField,
} from '@shopify/polaris';
import { applyFix } from '../../../api/fixClient';
import type { FixPayload } from '../../../api/fixClient';
import { registerAIFix } from '../../../utils/aiFixRegistry';
import { friendlyError } from '../../../utils/friendlyError';

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
      const fixToApply = { ...fix, newValue: editedValue };
      const result = await applyFix(shop, token, fixToApply);
      if (result.manual) {
        setResult({ success: true, message: result.message || 'This change must be done manually in Shopify Admin.' });
      } else {
        setResult({ success: true, message: 'Fix applied successfully! The change is now live on your store.' });
      }
      // Register in AI fix registry so this field is never re-suggested
      registerAIFix(fix.resourceId || '', fix.field || '', fix.label || '');
      onFixed?.(fix);
      if (!result.manual) refreshData?.();
    } catch (err: any) {
      setResult({ success: false, message: friendlyError(err.message) });
    } finally {
      setApplying(false);
    }
  }, [fix, shop, onFixed, editedValue, refreshData]);

  const handleClose = useCallback(() => {
    setResult(null);
    onClose();
  }, [onClose]);

  if (!fix) return null;

  const typeLabel = fix.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const charCount = editedValue.length;

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
      }}
      secondaryActions={result?.success ? [] : [{ content: 'Cancel', onAction: handleClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Fix metadata */}
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="info">{typeLabel}</Badge>
            {fix.field && <Badge>{fix.field}</Badge>}
            {fix.resourceTitle && (
              <Text as="span" variant="bodySm" tone="subdued">{fix.resourceTitle}</Text>
            )}
          </InlineStack>

          {/* Diff view */}
          <div style={{
            border: '1px solid var(--p-color-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {/* Current */}
            <div style={{
              padding: '12px 16px',
              background: 'var(--p-color-bg-surface-critical)',
              borderBottom: '1px solid var(--p-color-border)',
            }}>
              <Text as="span" variant="bodySm" fontWeight="semibold" tone="critical">Current value</Text>
              <div style={{
                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                marginTop: 8, maxHeight: 120, overflow: 'auto',
                color: 'var(--p-color-text-secondary)',
              }}>
                {fix.oldValue || '(empty)'}
              </div>
            </div>

            {/* Arrow */}
            <div style={{
              textAlign: 'center', padding: '4px 0',
              background: 'var(--p-color-bg-surface-secondary)',
              fontSize: 12, color: 'var(--p-color-text-subdued)',
            }}>↓ proposed change</div>

            {/* Proposed */}
            <div style={{
              padding: '12px 16px',
              background: 'var(--p-color-bg-surface-success)',
            }}>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodySm" fontWeight="semibold" tone="success">Proposed value</Text>
                <Text as="span" variant="bodySm" tone="subdued">{charCount} chars</Text>
              </InlineStack>
              <div style={{ marginTop: 8 }}>
                <TextField
                  label="Proposed value"
                  labelHidden
                  value={editedValue}
                  onChange={setEditedValue}
                  multiline={4}
                  autoComplete="off"
                  disabled={applying || !!result?.success}
                />
              </div>
            </div>
          </div>

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
