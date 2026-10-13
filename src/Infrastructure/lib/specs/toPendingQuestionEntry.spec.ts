import { describe, expect, it } from 'vitest';
import type { FormFields } from '@opencode/client';
import { toPendingQuestionEntry } from '../toPendingQuestionEntry';
import { formInfo } from './fixtures';

describe('toPendingQuestionEntry', () => {
  it('proyecta la identidad y el título del formulario', () => {
    const entry = toPendingQuestionEntry(
      formInfo({ id: 'form-1', sessionID: 'ses-1', title: '¿Aplicar?' }),
    );

    expect(entry.id).toBe('form-1');
    expect(entry.title).toBe('¿Aplicar?');
  });

  it('marca siempre la pregunta como pendiente y sin respuesta', () => {
    const entry = toPendingQuestionEntry(formInfo({ id: 'f', sessionID: 's' }));

    expect(entry.state).toBe('pending');
    expect(entry.answer).toBeNull();
  });

  it('mapea key/type/title de cada campo y usa null sin título', () => {
    const fields: FormFields = [
      { key: 'reason', type: 'string', options: [] },
      { key: 'choice', title: 'Opción', type: 'multiselect', options: [] },
    ];

    const entry = toPendingQuestionEntry(
      formInfo({ id: 'f', sessionID: 's', fields }),
    );

    expect(entry.fields).toEqual([
      { key: 'reason', title: null, type: 'string', options: [] },
      { key: 'choice', title: 'Opción', type: 'multiselect', options: [] },
    ]);
  });

  it('expone options solo en los campos string/multiselect', () => {
    const fields: FormFields = [
      {
        key: 'reason',
        title: 'Motivo',
        type: 'string',
        options: [{ value: 'ok', label: 'Correcto' }],
      },
      {
        key: 'choice',
        title: 'Opción',
        type: 'multiselect',
        options: [{ value: 'a', label: 'A' }],
      },
      { key: 'count', title: 'Cantidad', type: 'number' },
      { key: 'flag', title: 'Activo', type: 'boolean' },
    ];

    const entry = toPendingQuestionEntry(
      formInfo({ id: 'f', sessionID: 's', fields }),
    );

    expect(entry.fields[0]?.options).toEqual([
      { value: 'ok', label: 'Correcto' },
    ]);
    expect(entry.fields[1]?.options).toEqual([{ value: 'a', label: 'A' }]);
    expect(entry.fields[2]?.options).toEqual([]);
    expect(entry.fields[3]?.options).toEqual([]);
  });

  it('trata como vacío un campo string sin options', () => {
    const fields: FormFields = [{ key: 'reason', type: 'string' }];

    const entry = toPendingQuestionEntry(
      formInfo({ id: 'f', sessionID: 's', fields }),
    );

    expect(entry.fields[0]?.options).toEqual([]);
  });

  it('no muta ni comparte las opciones de la entrada', () => {
    const options = [{ value: 'ok', label: 'Correcto' }];
    const fields: FormFields = [{ key: 'reason', type: 'string', options }];
    const form = formInfo({ id: 'f', sessionID: 's', fields });

    const entry = toPendingQuestionEntry(form);

    expect(entry.fields[0]?.options).not.toBe(options);
    expect(form.fields[0]).toEqual({
      key: 'reason',
      type: 'string',
      options: [{ value: 'ok', label: 'Correcto' }],
    });
  });
});
