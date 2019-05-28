
import { Sample } from '../src/index'
describe('index', ()=> {
    it('should support hello', () => {
        let idx = new Sample()
        expect(idx.hello()).toBe('world')
    })
})