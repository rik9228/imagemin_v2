import c from 'ansi-colors'
import log from 'fancy-log'
import fs from 'fs'
import globule from 'globule'
import sharp from 'sharp'

class ImageFormatConverter {
    constructor(options = {}) {
        this.srcBase = options.srcBase || 'src'
        this.destBase = options.destBase || 'dist'
        this.includeExtensionName = options.includeExtensionName || false
        this.formats = options.formats || [
            {
                type: 'avif',
                quality: 80
            },
            // Webp変換（画質を損なうので、必要に応じて使う）
            // {
            //     type: 'webp',
            //     quality: 80
            // }
        ]

        // Google推奨の画像圧縮率85 （https://developers.google.com/speed/docs/insights/OptimizeImages?hl=ja#gif%E3%80%81png%E3%80%81jpeg-%E7%94%BB%E5%83%8F%E3%81%AE%E6%9C%80%E9%81%A9%E5%8C%96）
        this.compressQuality = options.compressQuality || 85
        this.srcImages = `${this.srcBase}/**/*.{jpg,jpeg,png}`
        this.init()
    }

    init = async () => {
        const imagePathList = this.findImagePaths()
        await this.convertAndCompressImages(imagePathList)
    }

    /**
     * globパターンで指定した画像パスを配列化して返す
     * @return { array } 画像パスの配列
     */
    findImagePaths = () => {
        return globule.find({
            src: [this.srcImages]
        })
    }

    /**
     * 画像を変換する
     * @param { string } imagePath 画像パス
     * @param { object } format 画像形式と圧縮品質
     */
    convertImageFormat = async (imagePath, format) => {
        const reg = /\/(.*)\.(jpe?g|png)$/i
        const [, imageName, imageExtension] = imagePath.match(reg)
        const imageFileName = this.includeExtensionName
            ? `${imageName}.${imageExtension}`
            : imageName
        const destPath = `${this.destBase}/${imageFileName}.${format.type}`
        await sharp(imagePath)
            .toFormat(format.type, { quality: format.quality })
            .toFile(destPath)
            .then((info) => {
                log(
                    `Converted ${c.blue(imagePath)} to ${c.yellow(
                        format.type.toUpperCase()
                    )} ${c.green(destPath)}`
                )
            })
            .catch((err) => {
                log(
                    c.red(
                        `Error converting image to ${c.yellow(
                            format.type.toUpperCase()
                        )}\n${err}`
                    )
                )
            })
    }

    /**
     * 画像を圧縮する
     * @param { string } imagePath 画像パス
     */
    compressImage = async (imagePath) => {
        const reg = /\/(.*)\.(jpe?g|png)$/i
        const [, imageName, imageExtension] = imagePath.match(reg)
        const destPath = `${this.destBase}/${imageName}.${imageExtension}`
        await sharp(imagePath)
            .jpeg({ quality: this.compressQuality }) // 圧縮品質はデフォルトで"80"
            .toFile(destPath)
            .then((info) => {
                log(
                    `Compressed ${c.blue(imagePath)} to ${c.green(destPath)} with quality ${c.yellow(this.compressQuality)}`
                )
            })
            .catch((err) => {
                log(
                    c.red(
                        `Error compressing image ${c.blue(imagePath)}\n${err}`
                    )
                )
            })
    }

    /**
     * 配列内の画像パスのファイルを変換および圧縮する
     * @param { array } imagePathList 画像パスの配列
     */
    convertAndCompressImages = async (imagePathList) => {
        if (imagePathList.length === 0) {
            log(c.red('No images found to convert or compress'))
            return
        }
        for (const imagePath of imagePathList) {
            const reg = new RegExp(`^${this.srcBase}/(.*/)?`)
            const path = imagePath.match(reg)[1] || ''
            const destDir = `${this.destBase}/${path}`
            if (!fs.existsSync(destDir)) {
                try {
                    fs.mkdirSync(destDir, { recursive: true })
                    log(`Created directory ${c.green(destDir)}`)
                } catch (err) {
                    log(`Failed to create directory ${c.green(destDir)}\n${err}`)
                }
            }
            const conversionPromises = this.formats.map((format) =>
                this.convertImageFormat(imagePath, format)
            )
            const compressPromise = this.compressImage(imagePath)
            await Promise.all([...conversionPromises, compressPromise])
        }
    }
}

const imageFormatConverter = new ImageFormatConverter()
