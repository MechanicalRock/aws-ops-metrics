import { hello } from '../src/handler'
describe('handler', ()=> {
    it('should succeed', ()=> {
        let event = {
            hello: 'world'
        }
         
        let cb = jest.fn()
        hello(event,jest.fn() as any,cb)

        expect(cb).toHaveBeenCalled()
        expect(cb).toHaveBeenCalledWith(null, expect.anything())
    })
})