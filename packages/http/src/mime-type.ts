/*
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types
 */

/**
 * MIME type for JSON data.
 */
export const applicationJson = `application/json`
export type applicationJson = typeof applicationJson

/**
 * MIME type for GraphQL response JSON.
 */
export const applicationGraphqlResponseJson = `application/graphql-response+json`
export type applicationGraphqlResponseJson = typeof applicationGraphqlResponseJson

/**
 * MIME type for multipart form data.
 */
export const multipartFormData = `multipart/form-data`
export type multipartFormData = typeof multipartFormData

/**
 * MIME type for plain text.
 */
export const textPlain = `text/plain`
export type textPlain = typeof textPlain

/**
 * MIME type for JavaScript application files.
 */
export const applicationJavascript = `application/javascript`
export type applicationJavascript = typeof applicationJavascript

/**
 * MIME type for XML application data.
 */
export const applicationXml = `application/xml`
export type applicationXml = typeof applicationXml

/**
 * MIME type for ZIP archives.
 */
export const applicationZip = `application/zip`
export type applicationZip = typeof applicationZip

/**
 * MIME type for binary data (generic).
 */
export const applicationOctetStream = `application/octet-stream`
export type applicationOctetStream = typeof applicationOctetStream

/**
 * MIME type for URL-encoded form data.
 */
export const applicationFormUrlEncoded = `application/x-www-form-urlencoded`
export type applicationFormUrlEncoded = typeof applicationFormUrlEncoded

/**
 * MIME type for multipart form data (alias).
 */
export const applicationFormMultipart = multipartFormData
export type applicationFormMultipart = multipartFormData

/**
 * MIME type for HTML documents.
 */
export const textHtml = `text/html`
export type textHtml = typeof textHtml

/**
 * MIME type for CSS stylesheets.
 */
export const textCss = `text/css`
export type textCss = typeof textCss

/**
 * MIME type for JavaScript text files.
 */
export const textJavaScript = `text/javascript`
export type textJavaScript = typeof textJavaScript

/**
 * MIME type for XML text files.
 */
export const textXml = `text/xml`
export type textXml = typeof textXml

/**
 * MIME type for CSV files.
 */
export const textCsv = `text/csv`
export type textCsv = typeof textCsv

/**
 * MIME type for JPEG images.
 */
export const imageJpeg = `image/jpeg`
export type imageJpeg = typeof imageJpeg

/**
 * MIME type for PNG images.
 */
export const imagePng = `image/png`
export type imagePng = typeof imagePng

/**
 * MIME type for GIF images.
 */
export const imageGif = `image/gif`
export type imageGif = typeof imageGif

/**
 * MIME type for SVG images.
 */
export const imageSvg = `image/svg+xml`
export type imageSvg = typeof imageSvg

/**
 * MIME type for WebP images.
 */
export const imageWebp = `image/webp`
export type imageWebp = typeof imageWebp

/**
 * MIME type for WOFF font files.
 */
export const fontWoff = `font/woff`
export type fontWoff = typeof fontWoff

/**
 * MIME type for WOFF2 font files.
 */
export const fontWoff2 = `font/woff2`
export type fontWoff2 = typeof fontWoff2

/**
 * MIME type for TrueType font files.
 */
export const fontTtf = `font/ttf`
export type fontTtf = typeof fontTtf

/**
 * MIME type for OpenType font files.
 */
export const fontOtf = `font/otf`
export type fontOtf = typeof fontOtf

/**
 * MIME type for MP3 audio files.
 */
export const audioMp3 = `audio/mpeg`
export type audioMp3 = typeof audioMp3

/**
 * MIME type for WAV audio files.
 */
export const audioWav = `audio/wav`
export type audioWav = typeof audioWav

/**
 * MIME type for OGG audio files.
 */
export const audioOgg = `audio/ogg`
export type audioOgg = typeof audioOgg

/**
 * MIME type for MP4 video files.
 */
export const videoMp4 = `video/mp4`
export type videoMp4 = typeof videoMp4

/**
 * MIME type for WebM video files.
 */
export const videoWebm = `video/webm`
export type videoWebm = typeof videoWebm

/**
 * MIME type for OGG video files.
 */
export const videoOgg = `video/ogg`
export type videoOgg = typeof videoOgg

/**
 * MIME type for ICO icon files.
 *
 * @see https://stackoverflow.com/questions/13827325/correct-mime-type-for-favicon-ico
 */
export const imageXIcon = `image/x-icon`
export type imageXIcon = typeof imageXIcon

/**
 * TODO
 */
export const applicationGraphqlResponse = applicationGraphqlResponseJson
export type applicationGraphqlResponse = applicationGraphqlResponseJson

/**
 * Union type of all supported MIME types.
 */
export type Any =
  | applicationJson
  | applicationGraphqlResponseJson
  | multipartFormData
  | textPlain
  | applicationJavascript
  | applicationXml
  | applicationZip
  | applicationOctetStream
  | applicationFormUrlEncoded
  | textHtml
  | textCss
  | textJavaScript
  | textXml
  | textCsv
  | imageJpeg
  | imagePng
  | imageGif
  | imageSvg
  | imageWebp
  | fontWoff
  | fontWoff2
  | fontTtf
  | fontOtf
  | audioMp3
  | audioWav
  | audioOgg
  | videoMp4
  | videoWebm
  | videoOgg
  | imageXIcon
