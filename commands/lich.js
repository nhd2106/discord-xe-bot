const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sheets = require('../sheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lich-xe')
    .setDescription('Xem lịch xe đã được duyệt')
    .addStringOption(opt =>
      opt.setName('ngay').setDescription('Ngày cần xem (VD: 20/03/2026). Mặc định: hôm nay').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const inputDate = interaction.options.getString('ngay');
    const date = inputDate || new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    try {
      const bookings = await sheets.getBookingsByDate(date);

      const embed = new EmbedBuilder()
        .setTitle(`🚗 Lịch xe ngày ${date}`)
        .setColor(0x3B82F6)
        .setTimestamp();

      if (bookings.length === 0) {
        embed.setDescription('Không có chuyến xe nào được duyệt cho ngày này.');
      } else {
        bookings.forEach((b, i) => {
          embed.addFields({
            name: `${i + 1}. [${b[0]}] ${b[4]} — ${b[5]}`,
            value: `👤 ${b[1]} | 👥 ${b[7]} người | 🎯 ${b[6]}`,
          });
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Không thể tải lịch xe. Vui lòng thử lại.' });
    }
  },
};
