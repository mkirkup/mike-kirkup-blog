// Load variables from `.env` as soon as possible
require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'development'}`
})

const { format } = require('date-fns')
const clientConfig = require('./client-config')

const isProd = process.env.NODE_ENV === 'production'

module.exports = {
  siteMetadata: {
    title: 'Mike Kirkup Blog',
    description: 'Personal blog by Mike Kirkup',
    siteUrl: 'https://mikekirkup.com',
  },
  plugins: [
    'gatsby-plugin-postcss',
    'gatsby-plugin-react-helmet',
    {
      resolve: 'gatsby-source-sanity',
      options: {
        ...clientConfig.sanity,
        token: process.env.SANITY_READ_TOKEN,
        watchMode: !isProd,
        overlayDrafts: !isProd
      }
    },
    {
      resolve: 'gatsby-plugin-feed',
      options: {
        query: `
          {
            site {
              siteMetadata {
                title
                description
                siteUrl
              }
            }
          }
        `,
        feeds: [
          {
            serialize: ({ query: { site, allSanityPost } }) => {
              return allSanityPost.edges.map(edge => {
                const { title, _rawExcerpt, slug, publishedAt, _rawBody } = edge.node
                const url = `${site.siteMetadata.siteUrl}/blog/${format(publishedAt, 'YYYY/MM')}/${slug.current}/`
                
                return {
                  title: title,
                  description: _rawExcerpt ? _rawExcerpt[0].children[0].text : '',
                  date: publishedAt,
                  url: url,
                  guid: url,
                  custom_elements: [{ "content:encoded": _rawBody ? _rawBody[0].children[0].text : '' }],
                }
              })
            },
            query: `
              {
                allSanityPost(
                  sort: { order: DESC, fields: publishedAt },
                  filter: { publishedAt: { ne: null } }
                ) {
                  edges {
                    node {
                      title
                      publishedAt
                      slug {
                        current
                      }
                      _rawExcerpt
                      _rawBody
                    }
                  }
                }
              }
            `,
            output: "/rss.xml",
            title: "Mike Kirkup Blog RSS Feed",
          },
        ],
      },
    },
  ]
}
