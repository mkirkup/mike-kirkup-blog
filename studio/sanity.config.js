import {defineConfig} from 'sanity'
import {deskTool} from 'sanity/desk'
import {visionTool} from '@sanity/vision'
import {dashboardTool} from '@sanity/dashboard'
import {netlifyWidget} from 'sanity-plugin-dashboard-widget-netlify'
import schemaTypes from './schemas'

export default defineConfig({
  name: 'default',
  title: 'Blog with Gatsby',
  
  projectId: 'd66qejae',
  dataset: 'production',
  
  plugins: [
    deskTool({
      structure: (S) => 
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Settings')
              .child(
                S.document()
                  .schemaType('siteSettings')
                  .documentId('siteSettings')
              ),
            S.divider(),
            ...S.documentTypeListItems().filter(listItem => !['siteSettings'].includes(listItem.getId()))
          ])
    }),
    visionTool(),
    dashboardTool({
      widgets: [
        netlifyWidget({
          title: 'Netlify Deploy',
          description: 'NOTE: Because these sites are static builds, they need to be re-deployed to see the changes when documents are published.',
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
        })
      ]
    })
  ],
  
  schema: {
    types: schemaTypes,
  },
})