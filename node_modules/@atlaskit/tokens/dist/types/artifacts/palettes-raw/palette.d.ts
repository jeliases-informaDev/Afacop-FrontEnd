/**
 * THIS FILE WAS CREATED VIA CODEGEN DO NOT MODIFY {@see http://go/af-codegen}
 * @codegen <<SignedSource::d990bbd734a8d8e531136e364654fcbc>>
 * @codegenCommand yarn build tokens
 */
type TokenValue = string | number;
type TokenValueOriginal = string | number;
type TokenAttributes = {
    group: string;
    category: string;
};
type Token = {
    value: TokenValue;
    filePath: string;
    isSource: boolean;
    attributes: TokenAttributes;
    original: {
        value: TokenValueOriginal;
        attributes: TokenAttributes;
    };
    name: string;
    path: string[];
};
declare const tokens: Token[];
export default tokens;
