import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { FaqAccordion } from './faq-accordion';

const items = [
  { question: 'Is Colres free?', answer: 'Yes, totally free.' },
  { question: 'Do I need LaTeX?', answer: 'No, the template handles it.' },
];

describe('FaqAccordion', () => {
  test('the first answer starts open and the rest start closed', () => {
    render(<FaqAccordion items={items} />);

    expect(screen.getByRole('button', { name: 'Is Colres free?' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Yes, totally free.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Do I need LaTeX?' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('No, the template handles it.')).not.toBeInTheDocument();
  });

  test('opening one question closes the other', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    await user.click(screen.getByRole('button', { name: 'Do I need LaTeX?' }));

    expect(screen.getByText('No, the template handles it.')).toBeVisible();
    expect(screen.queryByText('Yes, totally free.')).not.toBeInTheDocument();
  });

  test('the open question can be collapsed', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    const first = screen.getByRole('button', { name: 'Is Colres free?' });
    await user.click(first);

    expect(first).toHaveAttribute('aria-expanded', 'false');
  });
});
