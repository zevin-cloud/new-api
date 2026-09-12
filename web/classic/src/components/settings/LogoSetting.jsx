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

import React, { useEffect, useId, useRef, useState } from 'react';
import { Button, Input } from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { prepareLogoImage } from '../../services/logo';

export default function LogoSetting({ value = '', onSave }) {
  const { t } = useTranslation();
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const draft = mode === 'url' ? url.trim() : image;

  useEffect(() => {
    const uploaded = value.startsWith('data:image/');
    setMode(uploaded ? 'upload' : 'url');
    setUrl(uploaded ? '' : value);
    setImage(uploaded ? value : '');
  }, [value]);

  useEffect(() => setPreviewFailed(false), [draft]);

  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      setImage(await prepareLogoImage(file));
      setFileName(file.name);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError('');
    if (mode === 'url' && draft && !/^(https?:\/\/|\/(?!\/))/.test(draft)) {
      setError('Enter an HTTP(S) URL or a path starting with /.');
      return;
    }
    setBusy(true);
    try {
      await onSave(draft);
    } catch {
      setError('Could not save the logo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='my-5 flex max-w-2xl flex-col gap-3'>
      <div className='font-semibold'>{t('Logo')}</div>
      <div
        className='flex flex-wrap gap-2'
        role='group'
        aria-label={t('Logo source')}
      >
        <Button
          htmlType='button'
          aria-pressed={mode === 'url'}
          theme={mode === 'url' ? 'solid' : 'light'}
          disabled={busy}
          onClick={() => {
            setMode('url');
            setError('');
          }}
        >
          {t('Image URL')}
        </Button>
        <Button
          htmlType='button'
          aria-pressed={mode === 'upload'}
          theme={mode === 'upload' ? 'solid' : 'light'}
          disabled={busy}
          onClick={() => {
            setMode('upload');
            setError('');
          }}
        >
          {t('Upload image')}
        </Button>
      </div>
      {mode === 'url' ? (
        <div className='flex flex-col gap-2'>
          <label htmlFor={inputId}>{t('Logo image URL')}</label>
          <Input
            id={inputId}
            value={url}
            onChange={setUrl}
            disabled={busy}
            placeholder='https://example.com/logo.png'
          />
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          <input
            ref={fileInputRef}
            id={inputId}
            aria-label={t('Choose logo image')}
            type='file'
            hidden
            accept='image/png,image/jpeg,image/webp'
            onChange={selectImage}
            disabled={busy}
          />
          <div className='flex min-w-0 flex-wrap items-center gap-3'>
            <Button
              htmlType='button'
              icon={<IconUpload aria-hidden={true} />}
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('Choose logo image')}
            </Button>
            {fileName && (
              <span className='min-w-0 break-all text-sm text-[var(--semi-color-text-2)]'>
                {fileName}
              </span>
            )}
          </div>
          <p className='text-sm text-[var(--semi-color-text-2)]'>
            {t(
              'PNG, JPEG or WebP, up to 5 MB. Images are resized automatically.',
            )}
          </p>
        </div>
      )}
      <div className='flex items-center gap-3'>
        {!previewFailed ? (
          <img
            key={draft}
            src={draft || '/logo.png'}
            alt={t('Logo preview')}
            onError={() => setPreviewFailed(true)}
            className='h-16 w-16 rounded-xl border border-[var(--semi-color-border)] object-contain p-2'
          />
        ) : (
          <span className='text-sm text-[var(--semi-color-text-2)]'>
            {t('Image preview unavailable.')}
          </span>
        )}
        <span className='text-sm text-[var(--semi-color-text-2)]'>
          {t('Save to apply the logo across the site and browser tab.')}
        </span>
      </div>
      {error && (
        <p role='alert' className='text-sm text-[var(--semi-color-danger)]'>
          {t(error)}
        </p>
      )}
      <div>
        <Button
          htmlType='button'
          onClick={save}
          loading={busy}
          disabled={busy || (mode === 'upload' && !image)}
        >
          {t('Save logo')}
        </Button>
      </div>
    </div>
  );
}
