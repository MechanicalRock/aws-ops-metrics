import { S3 } from 'aws-sdk'

describe('integration test', ()=> {

    let s3 = new S3({
        apiVersion: '2006-03-01', 
        // https://github.com/localstack/localstack/issues/43
        s3ForcePathStyle: true,
        endpoint: 'http://localstack:4572',
        accessKeyId: 'DUMMY',
        secretAccessKey: 'DUMMY'
    })

    let bucketName = "my-sample-bucket"

    beforeAll(async (done) => {
        try{

            let result = await s3.createBucket({
                Bucket: bucketName
            }).promise()
            done()
        }catch(err){
            done.fail()
        }
    })

    afterAll( async (done) => {
        try{
            let result = await s3.deleteBucket({
                Bucket: bucketName
            }).promise()
            done()
        }catch (err){
            done.fail()
        }
    })

    it('shouold create the bucket on localstack', async (done) => {
        let results = await s3.listBuckets().promise()

        expect(results.Buckets).toHaveLength(1)
        expect(results.Buckets[0].Name).toBe(bucketName)
        done()
    }, 10000)
})