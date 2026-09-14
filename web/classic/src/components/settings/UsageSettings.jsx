/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useState } from 'react';
import { Button, Input, Switch } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import { setStatusData } from '../../helpers/data';
import {
  resolveUsageOptions,
  saveUsageSettings,
  loadUsageStatus,
} from '../../services/usageSettings';

export default function UsageSettings(props) {
  const { t } = useTranslation();
  const statusContext = useContext(StatusContext);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const values = { ...resolveUsageOptions(props.options), ...draft };
  const labelText = values['usage_setting.site_label_text'].trim();
  const labelInvalid =
    props.section === 'label' && (!labelText || [...labelText].length > 20);
  const changed = Object.keys(draft).length > 0;
  let fields = [];
  if (props.section === 'models') {
    fields = [
      {
        key: 'usage_setting.allow_unpriced_models_enabled',
        label: t('Allow requests to unpriced models'),
        description: t(
          'Unpriced models use fallback billing. Existing user exceptions still apply.',
        ),
      },
      {
        key: 'usage_setting.show_unpriced_models_enabled',
        label: t('Show unpriced models'),
        description: t(
          'Listing a model does not allow requests. Model permissions and user exceptions still apply.',
        ),
      },
    ];
  } else if (props.section === 'registration') {
    fields = [
      {
        key: 'usage_setting.show_registration_enabled',
        label: t('Show registration entry'),
        description: t(
          'Shows registration links only when registration is enabled. This does not control the registration API.',
        ),
      },
    ];
  } else {
    fields = [
      {
        key: 'usage_setting.site_label_enabled',
        label: t('Show site label'),
        description: t(
          'Display only. Does not change model access, billing or registration.',
        ),
      },
    ];
  }

  async function save() {
    if (labelInvalid) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const changes = { ...draft };
      if (
        props.section === 'label' &&
        changes['usage_setting.site_label_text'] !== undefined
      )
        changes['usage_setting.site_label_text'] = labelText;
      await saveUsageSettings(changes);
      await props.refresh();
      setDraft({});
      setSaved(true);
      try {
        const status = await loadUsageStatus();
        setStatusData(status);
        if (Array.isArray(statusContext))
          statusContext[1]({ type: 'set', payload: status });
      } catch {
        setError(t('Settings saved. Reload the page to refresh site display.'));
      }
    } catch (err) {
      setError(err.message || t('Unable to save settings'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='my-4 space-y-4'>
      {fields.map((field) => (
        <div key={field.key}>
          <div className='flex items-center gap-3'>
            <Switch
              id={field.key}
              aria-label={field.label}
              aria-describedby={`${field.key}-description`}
              checked={values[field.key]}
              disabled={saving}
              onChange={(value) => {
                setDraft((previous) => ({ ...previous, [field.key]: value }));
                setSaved(false);
              }}
            />
            <label htmlFor={field.key}>{field.label}</label>
          </div>
          <p
            id={`${field.key}-description`}
            className='mt-1 text-sm text-semi-color-text-2'
          >
            {field.description}
          </p>
        </div>
      ))}
      {props.section === 'label' && (
        <div className='max-w-sm space-y-2'>
          <label htmlFor='site-label-text'>{t('Site label text')}</label>
          <Input
            id='site-label-text'
            aria-label={t('Site label text')}
            aria-invalid={labelInvalid}
            aria-describedby='site-label-help'
            value={values['usage_setting.site_label_text']}
            disabled={saving}
            onChange={(value) => {
              setDraft((previous) => ({
                ...previous,
                'usage_setting.site_label_text': value,
              }));
              setSaved(false);
            }}
          />
          <p id='site-label-help' className='text-sm text-semi-color-text-2'>
            {t(
              'Enter 1–20 characters. Whitespace-only labels are not allowed.',
            )}
          </p>
        </div>
      )}
      <Button
        htmlType='button'
        onClick={save}
        loading={saving}
        disabled={!changed || labelInvalid}
      >
        {t('Save these settings')}
      </Button>
      {error && <p role='alert'>{error}</p>}
      {saved && <p role='status'>{t('Settings saved')}</p>}
    </div>
  );
}
