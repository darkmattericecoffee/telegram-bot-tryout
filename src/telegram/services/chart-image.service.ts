// src/telegram/chart-image.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import * as sharp from 'sharp';

@Injectable()
export class ChartImageService {
  private readonly logger = new Logger(ChartImageService.name);

  async generateMockChart(
    coin: string,
    pairing: string,
    timeframe: string,
  ): Promise<Buffer> {
    this.logger.log(`Generating mock chart for ${coin} - ${pairing} (${timeframe})`);

    // Generate mock OHLC data
    const ohlcData = this.generateMockOHLC();
    const smaData = this.generateMockSMA(ohlcData);

    // Create an SVG using d3
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    const body = d3.select(dom.window.document).select('body');
    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = body.append('svg')
      .attr('width', width)
      .attr('height', height);

    // Define scales
    const xScale = d3.scaleLinear()
      .domain([0, ohlcData.length - 1])
      .range([margin.left, width - margin.right]);

    const yExtent = [
      d3.min(ohlcData, d => d.low) as number,
      d3.max(ohlcData, d => d.high) as number,
    ];
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - margin.bottom, margin.top]);

    // Draw OHLC candlesticks (simplified: draw a rectangle for candle body and a line for high-low)
    ohlcData.forEach((d, i) => {
      const x = xScale(i);
      // Candle body
      svg.append('rect')
        .attr('x', x - 5)
        .attr('y', yScale(Math.max(d.open, d.close)))
        .attr('width', 10)
        .attr('height', Math.abs(yScale(d.open) - yScale(d.close)))
        .attr('fill', d.close > d.open ? 'green' : 'red');
      
      // High-low line
      svg.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', yScale(d.high))
        .attr('y2', yScale(d.low))
        .attr('stroke', 'black');
    });

    // Draw the SMA line
    const line = d3.line<number>()
      .x((d, i) => xScale(i))
      .y(d => yScale(d));

    svg.append('path')
      .datum(smaData)
      .attr('fill', 'none')
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('d', line as any);

    // Draw a colored band (ssma band) – here we’ll make a second line slightly below the SMA and fill between them
    const sma2 = smaData.map(v => v * 0.98); // a mock second SMA
    const area = d3.area<number>()
      .x((d, i) => xScale(i))
      .y0((d, i) => yScale(sma2[i]))
      .y1(d => yScale(d));

    svg.append('path')
      .datum(smaData)
      .attr('fill', 'orange')
      .attr('opacity', 0.3)
      .attr('d', area as any);

    // Optionally add a title to the chart
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', margin.top)
      .attr('text-anchor', 'middle')
      .attr('fill', 'black')
      .attr('font-size', '16px')
      .text(`${coin} Chart`);

    // Convert the SVG to a PNG buffer using sharp
    const svgString = body.html();
    return await sharp(Buffer.from(svgString)).png().toBuffer();
  }

  private generateMockOHLC(): { open: number; close: number; high: number; low: number }[] {
    const data: { open: number; close: number; high: number; low: number }[] = [];
    let price = 100;
    for (let i = 0; i < 30; i++) {
      const open = price;
      const close = open + (Math.random() - 0.5) * 10;
      const high = Math.max(open, close) + Math.random() * 5;
      const low = Math.min(open, close) - Math.random() * 5;
      data.push({ open, close, high, low });
      price = close;
    }
    return data;
  }

  private generateMockSMA(data: { open: number; close: number; high: number; low: number }[]): number[] {
      // Simple moving average (window of 5)
      const sma: number[] = [];
      for (let i = 0; i < data.length; i++) {
        const windowData = data.slice(Math.max(0, i - 4), i + 1);
        const sum = windowData.reduce((acc, d) => acc + d.close, 0);
        sma.push(sum / windowData.length);
      }
      return sma;
    }
}