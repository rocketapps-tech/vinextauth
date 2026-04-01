import { ptSource } from '@/lib/source';
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = ptSource.getPage(slug ?? []);
  if (!page) return notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return ptSource.generateParams();
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = ptSource.getPage(slug ?? []);
  if (!page) return notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
