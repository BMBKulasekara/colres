import { getGalleryData, templateCount } from '../../_lib/templates';
import { Section } from '../ui/section';
import { TemplateGalleryGrid } from './template-gallery-grid';

/** Server wrapper: reads the catalog and hands a slim list to the client grid. */
export function TemplateGallery() {
  const { templates, categories } = getGalleryData();

  return (
    <Section id="templates" labelledBy="templates-heading">
      <TemplateGalleryGrid
        templates={templates}
        categories={categories}
        totalCount={templateCount}
      />
    </Section>
  );
}
