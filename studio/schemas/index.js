// document schemas
import author from './documents/author'
import category from './documents/category'
import post from './documents/post'
import siteSettings from './documents/siteSettings'

// Object types
import bodyPortableText from './objects/bodyPortableText'
import bioPortableText from './objects/bioPortableText'
import excerptPortableText from './objects/excerptPortableText'
import mainImage from './objects/mainImage'
import authorReference from './objects/authorReference'

export default [
  // Document types
  siteSettings,
  post,
  category,
  author,
  // Object types
  mainImage,
  authorReference,
  bodyPortableText,
  bioPortableText,
  excerptPortableText
]