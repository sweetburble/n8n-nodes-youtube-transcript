import {
	ApplicationError,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { YoutubeTranscript } from 'youtube-transcript';

export class YoutubeTranscriptNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Youtube Transcript',
		name: 'youtubeTranscriptNode',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:youTube.png',
		group: ['transform'],
		version: 1,
		description: 'Get Transcript of a youtube video',
		defaults: {
			name: 'Youtube Transcript',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Youtube Video ID or Url',
				name: 'youtubeId',
				type: 'string',
				default: '',
				placeholder: 'Youtube Video ID or Url',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const getTranscriptFromYoutube = async function (youtubeId: string) {
			try {
				const url = `https://www.youtube.com/watch?v=${youtubeId}`;
				const transcript = await YoutubeTranscript.fetchTranscript(url);

				return transcript;
			} catch (error) {
				if (error instanceof ApplicationError) {
					throw error;
				} else {
					throw new ApplicationError(`Failed to extract transcript: ${error.message}`);
				}
			}
		};

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		let youtubeId: string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				youtubeId = this.getNodeParameter('youtubeId', itemIndex, '') as string;

				const urlRegex = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/;

				if (urlRegex.test(youtubeId)) {
					const url = new URL(youtubeId);

					if (url.hostname === 'youtu.be') {
						youtubeId = url.pathname.slice(1); // Extract the video ID from the path
					} else {
						const v = url.searchParams.get('v');
						if (!v) {
							throw new ApplicationError(
								`The provided URL doesn't contain a valid YouTube video identifier. URL: ${youtubeId}`,
							);
						}
						youtubeId = v;
					}
				}

				const transcript = await getTranscriptFromYoutube(youtubeId);

				let text = '';
				// transcript가 존재하고 배열인 경우에만 반복문 실행
				if (transcript && Array.isArray(transcript)) {
					for (const line of transcript) {
						// 각 line 객체에 text 속성이 있는지 확인하고, text 속성을 사용
						if (line && typeof line.text === 'string') {
							text += line.text + ' ';
						}
					}
				}
				returnData.push({
					json: {
						youtubeId: youtubeId,
						text: text.trim(), // 마지막 공백 제거
					},
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
