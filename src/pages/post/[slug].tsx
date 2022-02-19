import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';

import { FiCalendar, FiUser, FiClock } from 'react-icons/fi';

import Prismic from '@prismicio/client';

import { RichText } from 'prismic-dom';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPrismicClient } from '../../services/prismic';

import commonStyles from '../../styles/common.module.scss';
import styles from './post.module.scss';

import Header from '../../components/Header';

import UtterancesComments from '../../components/Utteranc';

interface Post {
  id: string;
  first_publication_date: string | null;
  last_publication_date: string | null;
  data: {
    title: string;
    banner: {
      url: string;
    };
    author: string;
    content: {
      heading: string;
      body: {
        text: string;
      }[];
    }[];
  };
  uid: string;
}

interface PostProps {
  post: Post;
  previousPost: Post;
  nextPost: Post;
  preview: boolean;
}

export default function Post({
  post,
  previousPost,
  nextPost,
  preview,
}: PostProps) {
  const router = useRouter();

  if (router.isFallback) {
    return <h1>Carregando...</h1>;
  }

  const totalWords = post.data.content.reduce(
    (totalContent, currentContent) => {
      const headingWords = currentContent.heading?.split(' ').length || 0;

      const bodyWords = currentContent.body.reduce((totalBody, currentBody) => {
        const textWords = currentBody.text.split(' ').length;
        return totalBody + textWords;
      }, 0);

      return totalContent + headingWords + bodyWords;
    },
    0
  );

  const timeEstimmed = Math.ceil(totalWords / 200);

  function dateFormat(date: string) {
    const formatedDate = format(new Date(date), 'dd MMM yyyy', {
      locale: ptBR,
    });

    return formatedDate;
  }

  function getUpdatedAt(date: string) {
    const time = date.split(/[\sT+:]+/);
    const formatedTime = `${time[1]}:${time[2]}`;

    return formatedTime;
  }

  return (
    <>
      <Head>
        <title>{post.data.title} | spacetraveling</title>
      </Head>

      <Header />

      <img src={post.data.banner.url} alt="banner" className={styles.banner} />
      <main className={commonStyles.container}>
        <article className={styles.post}>
          <h1>{post.data.title}</h1>
          <div className={commonStyles.info}>
            <time>
              <FiCalendar />
              <>
                * editado em {dateFormat(post.last_publication_date)}, às{' '}
                {getUpdatedAt(post.last_publication_date)}
              </>
            </time>
            <span>
              <FiUser />
              {post.data.author}
            </span>
            <time>
              <FiClock />
              {timeEstimmed} min
            </time>
          </div>
          {post.data.content.map(content => {
            return (
              <section key={content.heading} className={styles.postContent}>
                <h2>{content.heading}</h2>
                <div
                  dangerouslySetInnerHTML={{
                    __html: RichText.asHtml(content.body),
                  }}
                />
              </section>
            );
          })}
        </article>

        <div className={styles.divider} />

        <div className={styles.commentForm}>
          <div className={styles.othersPostsLinks}>
            <div>
              {previousPost && (
                <>
                  <p>{previousPost.data?.title}</p>
                  <Link href={`/post/${previousPost.uid}`}>
                    <a>Post anterior</a>
                  </Link>
                </>
              )}
            </div>

            <div>
              {nextPost && (
                <>
                  <p>{nextPost.data?.title}</p>
                  <Link href={`/post/${nextPost.uid}`}>
                    <a>Próximo post</a>
                  </Link>
                </>
              )}
            </div>
          </div>

          <UtterancesComments />

          {preview && (
            <div className={styles.outPreviewModeButton}>
              <Link href="/api/exit-preview">
                <a>Sair do modo Preview</a>
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prismic = getPrismicClient();
  const posts = await prismic.query([
    Prismic.Predicates.at('document.type', 'post'),
  ]);

  const paths = posts.results.map(post => {
    return {
      params: {
        slug: post.uid,
      },
    };
  });

  return {
    paths,
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps = async ({
  preview = false,
  previewData,
  params,
}) => {
  const prismic = getPrismicClient();
  const { slug } = params;

  const post =
    (await prismic.getByUID('post', String(slug), {
      ref: previewData?.ref || null,
    })) || ({} as Post);

  const previousPostResponse = await prismic.query(
    [Prismic.predicates.at('document.type', 'post')],
    {
      pageSize: 1,
      after: `${post.id}`,
      orderings: '[document.first_publication_date desc]',
    }
  );

  const nextPostResponse = await prismic.query(
    [Prismic.predicates.at('document.type', 'post')],
    {
      pageSize: 1,
      after: `${post.id}`,
      orderings: '[document.first_publication_date]',
    }
  );

  const previousPost =
    previousPostResponse.results.length > 0
      ? previousPostResponse.results[0]
      : null;

  const nextPost =
    nextPostResponse.results.length > 0 ? nextPostResponse.results[0] : null;

  return {
    props: {
      post,
      previousPost,
      nextPost,
      preview,
    },
    revalidate: 60 * 30, // time to generate new page (one time a day) (Only for SSG)
  };
};
