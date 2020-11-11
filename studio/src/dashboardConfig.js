export default {
  widgets: [
    { name: 'structure-menu' },
    {
      name: 'project-info',
      options: {
        __experimental_before: [
          {
            name: 'netlify',
            options: {
              description:
                'NOTE: Because these sites are static builds, they need to be re-deployed to see the changes when documents are published.',
              sites: [
                {
                  buildHookId: '5fab516ee08a3a11d6cc0839',
                  title: 'Sanity Studio',
                  name: 'mike-kirkup-blog-studio',
                  apiId: 'e1c03d33-ea5a-4453-9065-71b398bf9d5a'
                },
                {
                  buildHookId: '5fab516e163cdb13eb595231',
                  title: 'Blog Website',
                  name: 'mike-kirkup-blog',
                  apiId: 'd628710c-5de7-4fa0-b29e-c735fea74bbc'
                }
              ]
            }
          }
        ],
        data: [
          {
            title: 'GitHub repo',
            value: 'https://github.com/mkirkup/mike-kirkup-blog',
            category: 'Code'
          },
          { title: 'Frontend', value: 'https://mike-kirkup-blog.netlify.app', category: 'apps' }
        ]
      }
    },
    { name: 'project-users', layout: { height: 'auto' } },
    {
      name: 'document-list',
      options: { title: 'Recent blog posts', order: '_createdAt desc', types: ['post'] },
      layout: { width: 'medium' }
    }
  ]
}
