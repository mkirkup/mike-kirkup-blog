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
          sites: []
        })
      ]
    })
  ],
  
  schema: {
    types: schemaTypes,
  },
})